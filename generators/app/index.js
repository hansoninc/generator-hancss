'use strict';
const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');
const mkdirp = require('mkdirp');
const GruntfileEditor = require('gruntfile-editor');
const fs = require('fs');

module.exports = class extends Generator {
	prompting() {
		// Have Yeoman greet the user.
		this.log(yosay(
			'Welcome to the ' + chalk.red('Hanson CSS standards') + ' generator!'
		));

		const prompts = [
			// Collect project type
			{
				type: 'list',
				name: 'projectType',
				message: 'What type of project is this?',
				choices: [
					{
						name: 'A plain HTML or unspecified project',
						value: 'plain'
					},
					{
						name: 'A .NET project',
						value: 'dotnet'
					},
					{
						name: 'A WordPress Project',
						value: 'wordpress'
					}
				],
				default: 'plain'
			},
			// Collect LESS/SCSS project preference
			{
				type: 'list',
				name: 'preprocessor',
				message: 'What preprocessor would you like to use?',
				choices: [
					{
						name: 'LESS',
						value: 'less'
					},
					{
						name: 'SCSS',
						value: 'scss'
					}
				],
				default: 'scss'
			},
			// Collect Bootstrap version
			{
				when: function(props) { return props.preprocessor === 'scss' },
				type: 'list',
				name: 'bootstrapVersion',
				message: 'What version of Bootstrap would you like?',
				choices: [
					{
						name: '3.x (recommended for most projects)',
						value: '3'
					},
					{
						name: '4.x (beta)',
						value: '4'
					}
				],
				default: '3'
			},
			// Collect style path
			{
				type: 'input',
				name: 'sourcePath',
				message: 'What would you like the path to your source styles to be?',
				default: function(props) {
					var r;

					switch (props.projectType) {
						case 'plain':
							r = `src/${props.preprocessor}`;
							break;
						case 'wordpress':
								r = `assets/${props.preprocessor}`;
							break;
						case 'dotnet':
							r = `Static/${props.preprocessor}`;
							break;
					}

					return r;
				}
			},
			// Collect built style path
			{
				type: 'input',
				name: 'buildPath',
				message: 'What would you like the path to your built CSS to be?',
				default: 'dist/css'
			}
		];

		return this.prompt(prompts).then(props => {
			// To access props later use this.props.someAnswer;
			this.props = props;
		});
	}

	configuring() {

		// Load existing Gruntfile.js, if it exists
		var gfEditor;

		if (this.fs.exists( this.destinationPath('Gruntfile.js') )) {
			gfEditor = new GruntfileEditor( fs.readFileSync( this.destinationPath('Gruntfile.js'), 'utf8' ) );
		} else {
			gfEditor = new GruntfileEditor();
		}

		// Configure postcss
		gfEditor.insertConfig( 'postcss', `{
			options: {
				map: true, // inline sourcemaps
					processors: [
					require('autoprefixer')({
						browsers: ['>5%', 'last 2 versions', 'iOS >= 9'],
						cascade: false
					}), // add vendor prefixes
				]
			},
			default: {
				src: '${this.props.buildPath}/*.css'
			}
		}`);
		gfEditor.loadNpmTasks('grunt-postcss');

		// Configure stylelint
		gfEditor.insertConfig('stylelint', `{
			options: {
				configFile: '.stylelintrc',
				formatter: 'string',
				ignoreDisables: false,
				fix: true,
				failOnError: true,
				outputFile: '',
				reportNeedlessDisables: false
			},
			src: [
				'${this.props.sourcePath}/**/*.${this.props.preprocessor}',
				'!${this.props.sourcePath}/lib/bootstrap/**/*.${this.props.preprocessor}'
			]
		}`);
		gfEditor.loadNpmTasks('grunt-stylelint');

		// Configure grunt-[sass|less]
		if (this.props.preprocessor === 'less') {
			gfEditor.insertConfig( 'less', `{
				options: {
					sourceMap: true
				},
				default: {
					files: {
						'${this.props.buildPath}/app.css': '${this.props.sourcePath}/app.less'
					}
				}
			}`);
			gfEditor.loadNpmTasks('grunt-contrib-less');
			gfEditor.registerTask('css', ['stylelint', 'less', 'postcss']);
		} else {
			gfEditor.insertConfig( 'sass', `{
				options: {
					sourceMap: true
				},
				default: {
					files: {
						'${this.props.buildPath}/app.css': '${this.props.sourcePath}/app.scss',
					}
				}
			}`);
			gfEditor.loadNpmTasks('grunt-sass');
			gfEditor.registerTask('css', ['stylelint', 'sass', 'postcss']);
		}

		// Write out modified Gruntfile
		fs.writeFileSync( this.destinationPath('Gruntfile.js'), gfEditor.toString() );
	}

	writing() {
		// Copy config files
		this.fs.copy(
			this.templatePath('default.editorconfig'),
			this.destinationPath('.editorconfig')
		);

		this.fs.copy(
			this.templatePath('default.stylelintrc'),
			this.destinationPath('.stylelintrc')
		);

		// Create base structure
		mkdirp(this.props.sourcePath);
		mkdirp(this.props.buildPath);

		// [sourcePath]/core
		mkdirp(`${this.props.sourcePath}/core`);

		// [sourcePath]/lib
		mkdirp(`${this.props.sourcePath}/lib`);

		// [sourcePath]/modules
		mkdirp(`${this.props.sourcePath}/modules`);

		// [sourcePath]/views
		mkdirp(`${this.props.sourcePath}/views`);

		// [sourcePath]/utils
		mkdirp(`${this.props.sourcePath}/utils`);

		// Write [sourcePath]/app.[less|scss]
		let appCssTemplate = (this.props.bootstrapVersion === '4') ? this.templatePath('src/app-bootstrap4.scss') : this.templatePath('src/app-bootstrap3.scss');
		this.fs.copy(
			appCssTemplate,
			this.destinationPath(`${this.props.sourcePath}/app.${this.props.preprocessor}`)
		)

		// Write core CSS includes to the output directory
		this.fs.copy(this.templatePath('src/core/_fonts.scss'), this.destinationPath(`${this.props.sourcePath}/core/_fonts.${this.props.preprocessor}`));
		this.fs.copy(this.templatePath('src/core/_icons.scss'), this.destinationPath(`${this.props.sourcePath}/core/_icons.${this.props.preprocessor}`));
		this.fs.copy(this.templatePath('src/core/_mixins.scss'), this.destinationPath(`${this.props.sourcePath}/core/_mixins.${this.props.preprocessor}`));
		this.fs.copy(this.templatePath('src/core/_variables.scss'), this.destinationPath(`${this.props.sourcePath}/core/_variables.${this.props.preprocessor}`));

		// Write core CSS includes to the output directory
		this.fs.copy(this.templatePath('src/utils/_utilities.scss'), this.destinationPath(`${this.props.sourcePath}/utils/_utilities.${this.props.preprocessor}`));
	}

	install() {
		// Copy package.json if it doesn't exist
		if (!this.fs.exists('package.json')) {
			this.fs.copy(
				this.templatePath('package.json'),
				this.destinationPath('package.json')
			);
		}

		// Install Grunt NPM module and plugins
		var dependencies = {
			"devDependencies": {
				"grunt": "^1.0.1",
				"grunt-postcss": "^0.9.0",
				"autoprefixer": "^7.1.6",
				"grunt-stylelint": "^0.9.0",
				"stylelint": "^8.2.0",
				"stylelint-config-standard": "^17.0.0"
			}
		};

		// Install Bootstrap and Grunt preprocessor plugin
		if (this.props.preprocessor === 'less') {
			dependencies.devDependencies['grunt-contrib-less'] = '^1.4.1';
			dependencies.devDependencies['bootstrap'] = '^3.3.7';
		} else {
			dependencies.devDependencies['grunt-sass'] = '^2.0.0';

			if (this.props.bootstrapVersion === '4') {
				dependencies.devDependencies['bootstrap-v4-dev'] = '^4.0.0-alpha.6';
			} else {
				dependencies.devDependencies['bootstrap-sass'] = '^3.3.7';
			}
		}

		this.fs.extendJSON('package.json', dependencies);

		this.installDependencies({
			'bower': false
		});
	}

	end() {
		// Copy Bootstrap to [sourcePath]/lib/bootstrap folder
		if (this.props.preprocessor === 'less') {
			this.fs.copy(
				this.destinationPath('node_modules/bootstrap/less/**/*'),
				this.destinationPath(`${this.props.sourcePath}/lib/bootstrap`)
			);
		} else if (this.props.bootstrapVersion === '4') {
			this.fs.copy(
				this.destinationPath('node_modules/bootstrap-v4-dev/scss/**/*'),
				this.destinationPath(`${this.props.sourcePath}/lib/bootstrap`)
			);
		} else {
			this.fs.copy(
				this.destinationPath('node_modules/bootstrap-sass/assets/stylesheets/bootstrap/**/*'),
				this.destinationPath(`${this.props.sourcePath}/lib/bootstrap`)
			);
		}
	}
};
