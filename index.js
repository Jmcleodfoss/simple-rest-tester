"use strict";

const path = require('path');

const chai = require('chai');
const expect = chai.expect;
const schemes = {
	'http': require('http'),
	'https' : require('https')
};

var debug = process.env.SRT_DEBUG || false;
var responses = {};

const macroRegex = /\${[^}]*}(\.[A-Za-z_][0-9A-Za-z_]*)?/g;
const envMacroRegex = /\${env}(\.([A-Za-z_][0-9A-Za-z_]*))/g;

/* Add a user-defined macro */
exports.addMacro = (macro, substitution) =>
{
	responses['${' + macro + '}'] = substitution;
}

/* Save results of query for future tests to use in a ${A}.b macro */
function saveMacros(prefix, responseStr)
{
	const responseObject = JSON.parse(responseStr);
	Object.keys(responseObject).forEach(function(key){
		const index = '${' + prefix + '}.' + key;
		responses[index] = responseObject[key];
	});
}

/* Perform ${A}.b macro substitution */
function substituteMacros(str)
{
	const envSubstitutions = str.match(envMacroRegex);
	if (envSubstitutions != null) {
		for (const value of envSubstitutions) {
			const index = value.split('.')[1];
			if (!process.env.hasOwnProperty(index))
				console.log('Warning: ${env} macro ' + value + ' is not defined');
			else
				str = str.replace(value, process.env[index]);
		}
	}

	const substitutions = str.match(macroRegex);
	if (substitutions == null)
		return str;

	for (const value of substitutions) {
		// Use of groups in rexexp means we need to make sure we are only substituting full macro values, not the optional qualifier');
		if (value.charAt(0) == '$' && !value.match(envMacroRegex)) {
			if (!responses.hasOwnProperty(value))
				console.log('Warning: macro ' + value + ' is not defined');
			else
				str = str.replace(value, responses[value]);
		}
	}
	return str;
}

exports.mocha = (reqDescr) =>
{
	const scheme = schemes[reqDescr.scheme];

	describe(reqDescr.description, function(done){
		this.timeout(reqDescr.timeout || 2000);

		let req;
		let statusCode;
		let responseStr = '';

		reqDescr = applyMacros(reqDescr);

		beforeEach(function(done){
			if (debug)
				console.log('path: ' + reqDescr.options.path);
			req = scheme.request(reqDescr.options, function(response) {
				responseStr = '';
				response.on('data', function(chunk){
					responseStr += chunk;
				});
				response.on('end', function(chunk){});
				statusCode = response.statusCode;
			});
			done();
		});

		after(function(done){
			if (reqDescr.saveResponse && statusCode == 200)
				saveMacros(reqDescr.testname, responseStr);
			done();
		});

		it(reqDescr.expectation, async function(){
			if (reqDescr.hasOwnProperty('payload')) {
				if (debug)
					console.log('payload: ' + JSON.stringify(payload));
				req.write(payload);
			}
			req.end();

			while (statusCode === undefined)
				await new Promise(resolve => setTimeout(resolve, 500));

			if (debug)
				console.log(`status: ${statusCode}\nresponse: '${responseStr}'`);

			expect(statusCode).to.equal(parseInt(reqDescr.status));

			if ('responseRegexp' in reqDescr)
				expect(responseStr).to.match(new RegExp(reqDescr.returnRegEx));
		});
	});
}

/** Apply all macro substitutions in the test object */
exports.applyMacros = (reqDescr) =>
{
	for (const m of Object.keys(reqDescr)) {
		if (typeof reqDescr[m] === 'string')
			reqDescr[m] = substituteMacros(reqDescr[m]);
		else if (typeof reqDescr[m] === 'object')
			reqDescr[m] = this.applyMacros(reqDescr[m]);
	}
	return reqDescr;
}
