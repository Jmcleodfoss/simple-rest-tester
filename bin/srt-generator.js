#! /usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const SwaggerParser = require('@apidevtools/swagger-parser');
const CommandLineArgs = require('command-line-args');
const CommandLineUsage = require('command-line-usage');

const urlRegexp = /(https?):\/\/([^:\/]*)(:([1-9][0-9]*))?(\/.*$)?/;
const contentType = 'application/json';

const SRTDataKey = 'x-srt';
const FILENAME_KEY = 'filename';

const optionDefinitions = [
	{ name: 'overwrite', alias: 'O', type: Boolean, description: 'Overwrite any existing files without asking' },
	{ name: 'server', alias: 's', type: Number, description: 'Index into server array from which to take scheme, host, and port' },
	{ name: 'help', alias: 'h', type: Boolean, description: 'Display this usage guide' },
	{ name: 'quiet', alias: 'q', type: Boolean, description: 'Suppress informational output' },
	{ name: 'verbose', alias: 'v', type: Boolean, description: 'Additional informational output' }
];
const commandlineHelpTemplate = path.basename(process.argv[1], ".js") + '[-h | [-o] [-s #] [-q] openapi-spec, [openapi-spec...]]';
const options = CommandLineArgs(optionDefinitions, { partial: true });
if (options.help) {
	const usage = CommandLineUsage([
		{
			header: 'Usage:',
			content: commandlineHelpTemplate
		},
		{
			header: 'Options',
			optionList: optionDefinitions
		},
		{
			content: 'Project home: {underline https://github.com/jmcleodfoss/simple-rest-tester}'
		}
	]);
	console.log(usage);
	process.exit(0);
}

const serverIndex = options.server || 0;
var fOverwriteAll = options.overwrite || false;

async function getFinalFilename(filename)
{
	const sleepPromise = (resolve) => { setTimeout(resolve, 500); };
	var finalFilename;
	const getOldFileDisposition = (filename, rl) => {
		rl.question(filename + ' already exists. overwrite / Overwrite all / rename / skip / quit? (oOrsq => o) > ', answer => {
			if (answer === 'q') {
				process.exit(0);
			}
			if (answer === '' || answer === 'o' || answer === 'O') {
				fOverwriteAll = answer === 'O';
				rl.close();
				finalFilename = filename;
				return;
			}
			if (answer == 'r') {
				rl.question('Enter new name for original file ' + filename + ' (If there is a file with the new name, it will be deleted) > ', newName => {
					if (!options.quiet)
						console.log('renaming existing ' + filename + ' to ' + newName);
					rl.close();
					fs.renameSync(filename, newName);
					finalFilename = filename;
				});
				return;
			}
			if (answer == 's') {
				rl.close();
				finalFilename = null;
				return;
			}

			if (fs.existsSync(filename))
				getOldFileDisposition(filename, rl);
		});
	};

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	getOldFileDisposition(filename, rl);
	while (finalFilename === undefined)
		await new Promise(sleepPromise);
	return finalFilename;
}

async function safeWriteFile(filename, testStr)
{
	if (!fOverwriteAll && fs.existsSync(filename))
		filename = await getFinalFilename(filename);

	if (filename === null) {
		if (!options.quiet)
			console.log('Not over-writing existing file ' + filename + ', skipping');
		return;
	}

	if (fs.existsSync(filename)) {
		if (!options.quiet)
			console.log('Over-writing existing file ' + filename);
	}

	if (options.verbose)
		console.log(`Writing file ${filename}`);
	fs.writeFile(filename, testStr, err => {
		if (err)
			throw err;
	});
}

function getExamples(methodObject, contentType)
{
	if (methodObject.hasOwnProperty('requestBody')) {
		const requestBody = methodObject.requestBody;
		if (requestBody.content.hasOwnProperty(contentType)) {
			if (requestBody.content[contentType].hasOwnProperty('examples'))
				return requestBody.content[contentType].examples;
		}

		return { '': requestBody.content[contentType].schema };
	}

	return { '': null };
}

function getPath(pathPrefix, path, srtObject)
{
	if (srtObject.hasOwnProperty('path-subst')) {
		const substitutionObject = srtObject['path-subst'];
		const substitutions = Array.isArray(substitutionObject) ? substitutionObject : [ substitutionObject ];
		substitutions.forEach(s => {
			const [text, replacement] = Object.entries(s)[0];
			path = path.replace(text, replacement);
		});
	}
	return pathPrefix + path + getSchemaSRTValue(srtObject, 'path-suffix', '');
}

function getTestName(method, path, response)
{
	return (method + '_' + path.split('/').slice(1).join('-') + '_' + response).replace(/[{}]/g, '');
}

function getSchemaSRTValue(object, key, defaultValue)
{
	return object != null && object.hasOwnProperty(key) ? object[key] : defaultValue;
}

function createTest(scheme, host, port, method, methodObject, pathPrefix, path, response, responseObject, srtObject, contentType, example, exampleObject)
{
	// If testing for a non-success response, we only need one test case.
	const appendExampleToName = example != '' && (response == 200 || response == 204);
	const srtOptions = srtObject != null && srtObject.hasOwnProperty('options') ? srtObject['options'] : null;

	let test = {
		testname: srtObject.hasOwnProperty(FILENAME_KEY) ? srtObject[FILENAME_KEY] : getTestName(method, path, response) + (appendExampleToName ? '_' + example : ''),
		description : getSchemaSRTValue(srtObject, 'description', method + ' ' + pathPrefix + path),
		expectation : getSchemaSRTValue(srtObject, 'expectation', 'tbd'),
		status : response,
		responseRegexp : getSchemaSRTValue(srtObject, 'responseRegexp', '.*'),
		scheme : getSchemaSRTValue(srtObject, 'scheme', scheme),
		options : {
			host: getSchemaSRTValue(srtOptions, 'host', host),
			port: getSchemaSRTValue(srtOptions, 'port', port),
			path: getPath(pathPrefix, path, srtObject),
			method: method
		},
	};

	if (srtObject != null && srtObject.hasOwnProperty('payload')) {
		test['payload'] = getSchemaSRTValue(srtObject, 'payload');
		test['options'].headers = { 'Content-Type': contentType };
	} else if (exampleObject != null) {
		test['payload'] = exampleObject.value;
		test['options'].headers = { 'Content-Type': contentType };
	}

	if (srtObject != null && srtObject.hasOwnProperty('payload-override')) {
		// Clone the payload before modifying it in case it is from #/components/examples, as we don't want to permanently change the underlying
		// This is not the cleanest way of doing this, but the code doesn't need to have fast responsiveness, and the payload should be only data, not functions
		test['payload'] = JSON.parse(JSON.stringify(test['payload']));
		for (const [key, value] of Object.entries(srtObject['payload-override']))
			test['payload'][key] = value;
	}

	if (srtObject != null && srtObject.hasOwnProperty('prerequisites')) {
		test['prerequisites'] = srtObject['prerequisites'];
	}

	if (response == 200) {
		if (!test['options'].hasOwnProperty('headers'))
			test['options'].headers = {};
		test['options'].headers['accept'] = 'application/json';

		if (srtObject.hasOwnProperty('saveResponse'))
			test['saveResponse'] = getSchemaSRTValue(srtObject, 'saveResponse', true);
		else if (responseObject.hasOwnProperty('links'))
			test['saveResponse'] = getSchemaSRTValue(srtObject, 'saveResponse', responseObject.hasOwnProperty('links'));
	}

	if (srtObject.hasOwnProperty('macroDef')) {
		test.macroDef = [];
		for (const m in srtObject.macroDef)
			test.macroDef.push(srtObject.macroDef[m]);
	}

	if (srtOptions != null && srtOptions.hasOwnProperty('headers')) {
		if (!test['options'].hasOwnProperty('headers'))
			test['options'].headers = {};

		const keys = Object.keys(srtOptions.headers);
		for (const k in keys) {
			const headerOption = keys[k];
			test['options'].headers[headerOption] = srtOptions.headers[headerOption];
		}
	}
	return test;
}

function generate(apiSpec)
{
	SwaggerParser.validate(apiSpec, async (err, api) => {
		if (err) {
			console.log(err);
			return;
		}

		const urlParts = api.servers[serverIndex].url.match(urlRegexp);
		const scheme = urlParts[1];
		const host = urlParts[2];
		const port = urlParts[4];
		const pathPrefix = urlParts[5] || '';

		for (const path in api.paths) {
			for (const methodLC in api.paths[path]) {
				const methodObject = api.paths[path][methodLC];
				const examples = getExamples(methodObject, contentType);
				const method = methodLC.toLocaleUpperCase();
				for (const response in methodObject.responses) {
					const responseObject = methodObject.responses[response];
					const srtData = responseObject.hasOwnProperty(SRTDataKey) ? responseObject[SRTDataKey] : null;
					if (srtData == null || (!Array.isArray(srtData) && getSchemaSRTValue(srtData, 'skip-test', false)))
						continue;

					// There can be either an array of SRT objects, or an array of examples, or a single SRT object (which is handled as an example)
					if (Array.isArray(srtData)) {
						// Process each srtObject, ignoring example data
						for (const srtObject of srtData) {
							const test = createTest(scheme, host, port, method, methodObject, pathPrefix, path, response, responseObject, srtObject, contentType, '', { '': null});
							const filename = test['testname'] + '.json';
							await safeWriteFile(filename, JSON.stringify(test, null, 2));
						}
					} else {
						for (const example in examples){
							// Process examples using first srtObject
							const srtObject = Array.isArray(srtData) ? srtData[0] : srtData;
							const test = createTest(scheme, host, port, method, methodObject, pathPrefix, path, response, responseObject, srtObject, contentType, example, examples[example]);
							const filename = test['testname'] + '.json';
							await safeWriteFile(filename, JSON.stringify(test, null, 2));

							// If testing for a non-success response, we only use one test case from the examples.
							if (response != 200 && response != 204)
								break;
						}
					}
				}
			}
		};
	});
}

if (!options.hasOwnProperty('_unknown')) {
	console.log('use: ' + commandlineHelpTemplate);
	process.exit(1);
}

for (const spec of options._unknown)
	generate(spec);
