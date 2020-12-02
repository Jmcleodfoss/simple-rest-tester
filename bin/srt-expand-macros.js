#! /usr/bin/env node
"use strict";
const fs = require('fs');
const basename = require('path').basename;
const CommandLineArgs = require('command-line-args');
const CommandLineUsage = require('command-line-usage');
const srt = require('../index.js');

const optionDefinitions = [
	{ name: 'help', alias: 'h', type: Boolean, description: 'Display this usage guide' },
	{ name: 'define', alias: 'D', type: String, lazyMultiple: true, description: 'Define macro as macro=substitution' }
];
const commandlineHelpTemplate = basename(process.argv[1], ".js") + '[-h | [-D macro-1=value-1 [-D macro-2=value2 [...]]] test-definition [test-definition [...]]]';
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
	const file = fs.readFileSync(jsonFile);
	const reqDescr = JSON.parse(file);

	if (reqDescr.hasOwnProperty('macroDef')) {
		for (const m in reqDescr.macroDef) {
			if (!reqDescr.macroDef[m].hasOwnProperty('name')) {
				console.log('warning: macro definition ' + n + ' is missing name, skipping');
			} else if (!reqDescr.macroDef[m].hasOwnProperty('definitionPhase')) {
				console.log('warning: macro definition ' + reqDescr.macroDef[n].name + ' is missing definitionPhase, skipping');
			} else if (!reqDescr.macroDef[m].hasOwnProperty('definition')) {
				console.log('warning: macro definition ' + reqDescr.macroDef[n].name + ' is missing definition, skipping');
			} else if (reqDescr.macroDef[m].definitionPhase == 'preRequest') {
				srt.addMacro(reqDescr.macroDef[m].name, 'pre-request defined macro')
			} else if (reqDescr.macroDef[m].definitionPhase == 'postResponse') {
				srt.addMacro(reqDescr.macroDef[m].name, 'post-response defined macro');
			} else {
				console.log('warning: unrecognized definition phase ' + reqDescr.macroDef[m].definitionPhase + ' in macro ' + reqDescr.macroDef[m].name + ', ignoring');
			}
		}
	}

	console.log(srt.applyMacros(reqDescr));
}
