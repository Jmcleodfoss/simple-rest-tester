#! /usr/bin/env mocha
"use strict";
const mocha_test = require('../index').mocha;

// Used to find circular dependencies
var currentFile;

// Objects describing all tests
var testData = getTestFiles();

// Keep track of which tests have been done so we don't perform any prerequisite tests twice.
var testDone = {};

// Find the prerequisites (other tests referred to in macros which have to be run before this test) for the given test object.
async function getPrerequisiteTests(testObj)
{
	const fileMacroRegexp = /\${([^}]*)}.[A-Za-z_][0-9A-Za-z_]*/g;

	var prerequisites = [];

	for (const k of Object.keys(testObj)) {
		const val = testObj[k];

		if (typeof val === 'string') {
			for (const m of val.matchAll(fileMacroRegexp)) {
				// Skip ${env} variables since they are not dependent on other tests
				if (m[1] != 'env')
					prerequisites.push(m[1]);
			}
		} else if (typeof val === 'object') {
			prerequisites = prerequisites.concat(await getPrerequisiteTests(val));
		}
	}

	if (testObj.hasOwnProperty('prerequisites')) {
		for (const p of testObj.prerequisites) {
			if (!prerequisites.includes(p))
				prerequisites.push(p);
		}
	}

	return prerequisites;
}

// Read in all test files
function getTestFiles()
{
	const glob = require('glob');
	const fs = require('fs');

	var testData = {};

	const files = glob.sync('*.json');
	for (const i in files) {
		const file = files[i];
		if (!fs.statSync(file).isFile() || file == 'package-lock.json')
			continue;

		testData[file] = JSON.parse(fs.readFileSync(file));
	}

	return testData;
}

// Find the file containing the desired prerequisite, since macros are named with the testname not the filename, and these might be different.
function prerequisiteFile(prerequisiteReference)
{
	for (const file of Object.keys(testData)) {
		if (testData[file].hasOwnProperty('testname') && testData[file].testname == prerequisiteReference)
			return file;
	}

	return null;
}

// Run tests on a file, ensuring all prerequisite files are run first if there are any macros which refere to results of other tests.
async function testFileAndPrerequisites(filename)
{
	if (testDone[filename])
		return;

	const prerequisiteRefs = await getPrerequisiteTests(testData[filename]);
	if (prerequisiteRefs.length > 0) {
		for (const i in prerequisiteRefs) {
			const prerequisite = prerequisiteFile(prerequisiteRefs[i]);
			if (prerequisite == currentFile) {
				console.log('Error: circular dependency detected starting in file ' + currentFile);
				process.exit(1);
			}

			if (prerequisite == null) {
				console.log('Error, prerequisite test file for prerequisite reference ' + prerequisiteRefs[i] + ' not found');
				return;
			}
			if (!testDone[prerequisite])
				await testFileAndPrerequisites(prerequisite);
		}
	}

	await mocha_test(testData[filename]);
	testDone[filename] = true;
}

// Loop through all files and run tests on them. This exists only so we can call the main test function with await.
async function test()
{
	// Do DELETE tests last, unless they are prerequisites for other tests.
	var destructiveTests = [];

	for (const filename of Object.keys(testData)) {
		if (testData[filename].hasOwnProperty('options') && testData[filename].options.hasOwnProperty('method') && testData[filename].options.method == 'DELETE')
			destructiveTests.push(filename);
		else
			await testFileAndPrerequisites(currentFile = filename);
	}

	for (var i = 0; i < destructiveTests.length; ++i)
		await testFileAndPrerequisites(currentFile = destructiveTests[i]);
}

test();
