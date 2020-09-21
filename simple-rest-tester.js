"use strict";

const http = require('http');
const path = require('path');

const chai = require('chai');
const expect = chai.expect;

var debug = process.env.DEBUG_TEST || false;
var responses = {};

/* Save results of query for future tests to use in a ${A}.b macro */
function saveMacros(jsonFile, responseStr)
{
	const prefix = path.basename(jsonFile, ".json");
	const responseObject = JSON.parse(responseStr);
	Object.keys(responseObject).forEach(function(key){
		const index = '${' + prefix + '}.' + key;
		responses[index] = responseObject[key];
	});
}

/* Perform ${A}.b macro substitution */
function substituteMacros(str)
{
	const macroRegex = /\${[^}]*}\.[A-Za-z_][0-9A-Za-z]*/;
	const substitutions = str.match(macroRegex);
	if (substitutions == null)
		return str;

	for (const value of substitutions)
		str = str.replace(value, responses[value]);
	return str;
}

exports.mocha = (reqDescr, jsonFile, scheme) =>
{
	if (scheme === undefined)
		scheme = http;

	describe(reqDescr.description, function(done){
		this.timeout(reqDescr.timeout || 2000);

		let req;
		let statusCode;
		let responseStr = '';

		beforeEach(function(done){
			reqDescr.options.path = substituteMacros(reqDescr.options.path);
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
				saveMacros(jsonFile, responseStr);
			done();
		});

		it(reqDescr.behavior, async function(){
			if (reqDescr.hasOwnProperty('payload')) {
				let payload = substituteMacros(JSON.stringify(reqDescr.payload));
				req.write(payload);
			}
			req.end();

			while (statusCode === undefined)
				await new Promise(resolve => setTimeout(resolve, 500));

			if (debug)
				console.log(`status: ${statusCode}\nresponse: '${responseStr}'`);

			expect(statusCode).to.equal(parseInt(reqDescr.status));

			if ('returnRegEx' in reqDescr)
				expect(responseStr).to.match(new RegExp(reqDescr.returnRegEx));
		});
	});
}
