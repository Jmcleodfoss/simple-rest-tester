"use strict";

const path = require('path');
const chai = require('chai');
const expect = chai.expect;
const schemes = {
	'http': require('http'),
	'https' : require('https')
};

var debug = process.env.SRT_DEBUG || false;
var macros = {};

const macroRegex = /\${[^}]*}(\.[A-Za-z_][0-9A-Za-z_]*)?/g;
const envMacroRegex = /\${env}(\.([A-Za-z_][0-9A-Za-z_]*))/g;

/* Add a user-defined macro. The macro parameter should not have ${}, or it will be saved as ${${...}}. */
exports.addMacro = (macro, substitution) =>
{
	if (!macro.match(macroRegex))
		macro = '${' + macro + '}';
	macros[macro] = substitution;
};

/* Save results of query for future tests to use in a ${A}.b macro */
function saveMacros(prefix, responseStr, macroDef)
{
	const macroPrefix = '${' + prefix + '}.'
	const responseObject = JSON.parse(responseStr);
	Object.keys(responseObject).forEach(function(key){
		const index = macroPrefix + key;
		macros[index] = responseObject[key];
	});

	if (macroDef !== null) {
		for (const m in macroDef) {
			if (macroDef[m].definitionPhase != 'postResponse')
				continue
			const f = eval(macroDef[m].definition);
			macros[macroPrefix + macroDef[m].name] = f(responseObject);
		}
	}
}

/* Perform ${A}.b, ${A}, and ${env}.b macro substitution */
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
			if (!macros.hasOwnProperty(value))
				console.log('Warning: macro ' + value + ' is not defined');
			else
				str = str.replace(value, macros[value]);
		}
	}
	return str;
}

/* Do testing for given request description object via Mocha.js */
exports.mocha = (reqDescr) =>
{
	const scheme = schemes[reqDescr.scheme];
	const sleepPromise = (resolve) => { setTimeout(resolve, 500); };

	describe(reqDescr.description, function(){
		this.timeout(reqDescr.timeout || 2000);

		let req;
		let statusCode;
		let responseStr = '';

		beforeEach(function(){
			if (reqDescr.hasOwnProperty('macroDef')) {
				for (const m in reqDescr.macroDef) {
					if (reqDescr.macroDef[m].definitionPhase != 'preRequest')
						continue
					const f = eval(reqDescr.macroDef[m].definition);
					macros['${' + reqDescr.macroDef[m].name + '}'] = f(reqDescr);
				}
			}

			reqDescr = exports.applyMacros(reqDescr);

			if (debug) {
				console.log('scheme: ' + reqDescr.scheme);
				console.log('host: ' + reqDescr.options.host);
				console.log('port: ' + reqDescr.options.port);
				console.log('path: ' + reqDescr.options.path);

				if (reqDescr.options.hasOwnProperty('headers')) {
				console.log('Headers');
					Object.keys(reqDescr.options.headers).forEach(function(key) {
						console.log('\t' + key + ': ' + reqDescr.options.headers[key]);
					})
				}
			}

			/* Out-of-the-box, node.js does not support DELETE with body, but we want to. */
			const deleteWithBody = reqDescr.options.method.toUpperCase() === 'DELETE' && reqDescr.hasOwnProperty('payload');
			if (deleteWithBody)
				reqDescr.options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(reqDescr.payload));

			req = scheme.request(reqDescr.options, function(response) {
				responseStr = '';

				response.on('data', function(chunk){
					responseStr += chunk;
				});

				response.on('end', function(chunk) {
					if (reqDescr.saveResponse && response.statusCode == 200)
						saveMacros(reqDescr.testname, responseStr, reqDescr.hasOwnProperty('macroDef') ? reqDescr.macroDef : null);
					statusCode = response.statusCode;
				});
			});
		});

		it(reqDescr.expectation, async function(){
			if (reqDescr.hasOwnProperty('payload')) {
				if (debug)
					console.log('payload: ' + JSON.stringify(reqDescr.payload));
				req.write(JSON.stringify(reqDescr.payload));
			}
			req.end();

			while (statusCode === undefined)
				await new Promise(sleepPromise);

			if (debug)
				console.log(`status: ${statusCode}\nresponse: '${responseStr}'`);

			expect(statusCode).to.equal(parseInt(reqDescr.status));

			if ('responseRegexp' in reqDescr)
				expect(responseStr).to.match(new RegExp(reqDescr.returnRegEx));
		});
	});
};

/* Apply all macro substitutions in the test object */
exports.applyMacros = (reqDescr) =>
{
	for (const m of Object.keys(reqDescr)) {
		if (typeof reqDescr[m] === 'string')
			reqDescr[m] = substituteMacros(reqDescr[m]);
		else if (typeof reqDescr[m] === 'object')
			reqDescr[m] = exports.applyMacros(reqDescr[m]);
	}
	return reqDescr;
};
