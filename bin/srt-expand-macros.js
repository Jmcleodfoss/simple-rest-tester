#! /usr/bin/env node
"use strict";
const fs = require('fs');
const basename = require('path').basename;
const CommandLineArgs = require('command-line-args');
const CommandLineUsage = require('command-line-usage');
const srt = require('../index.js');

const optionDefinitions = [
	{ name: 'help', alias: 'h', type: Boolean, description: 'Display this usage guide' },
	{ name: 'define', alias: 'D', type: String, lazyMultiple: true, description: 'Define macro as macro=substotution' }
];
const commandlineHelpTemplate = basename(process.argv[1], ".js") + '[-h | [-D macro-1=value-1 [-D acro-2=value2 [...]]] test-definition [test-definition [...]]]';
const options = CommandLineArgs(optionDefinitions, { partial: true });
if (options.help) {
	const usage = CommandLineUsage([
		{
			header: 'Description',
			content: 'Apply macros to simple-rest-tester JSON definition files to show the final version'
		},
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

if (!options.hasOwnProperty('_unknown')) {
	console.log('use: ' + commandlineHelpTemplate);
	process.exit(1);
}

if (options.hasOwnProperty('define')) {
	for (const macro of options.define) {
		const index = macro.indexOf('=');
		if (index == -1) {
			console.log('Error: -D macro must have the form macro=substitution.');
			process.exit(1);
		}
		srt.addMacro(macro.substring(0, index), macro.substring(index+1));
	}
}

for (const jsonFile of options._unknown) {
	try {
		const file = fs.readFileSync(jsonFile);
		const reqDescr = JSON.parse(file);
		console.log(srt.applyMacros(reqDescr));
	} catch (ex) {
		console.log(ex);
	}
}
