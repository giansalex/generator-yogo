'use strict';
var yeoman = require('yeoman-generator');
var _ = require('lodash');
var chalk = require('chalk');
var yosay = require('yosay');
// Var fs = require('fs');
var toml = require('toml');
var ejs = require('ejs');

module.exports = class extends yeoman {
  _getRepoUrl() {
    var destinationPath = this.destinationRoot();
    var repoUrl = '';

    this.log('Destination Path = ', destinationPath);

    var index = destinationPath.indexOf('/src/');
    this.log('index = ', index);

    if (index !== -1) {
      repoUrl = destinationPath.substring(index + '/src/'.length);
    }

    this.log('repoUrl = ', repoUrl);

    return repoUrl;
  }

  initializing() {
    this.props = {};
    this.pathToTemplates = '../../templates';
    this.repoUrl = this._getRepoUrl();
  }

  configuring() {
    this.log('configuring');
    this.projectName = _.kebabCase(this.appname);
  }

  prompting() {
    if (this.repoUrl.length === 0) {
      this.log(
        "You need to create progect in directory 'GOPATH/src/<YOUR_PROJECT>'. Sorry but in current directory you can't create"
      );
      return;
    }

    // Welcome message
    this.log(
      yosay(
        'Welcome to ' +
          chalk`{bold.rgb(239, 115, 16) YoGo} ` +
          chalk`{bold.rgb(105, 215, 226) GoLang} generator!`
      )
    );

    var prompts = [
      {
        type: 'list',
        name: 'project',
        message: 'What type of application do you want to create?',
        choices: [
          {
            name: 'Empty Console Application (with "Hello world")',
            value: 'console'
          },
          {
            name: 'REST API microservice',
            value: 'restapi'
          },
          {
            name: 'GO-KIT microservice',
            value: 'gokitapi'
          }
          // {
          //   name: 'Basic Worker',
          //   value: 'worker',
          // },
          // {
          //   name: 'Basic Golang Consumer (KAFKA)',
          //   value: 'consumer',
          // },
          // {
          //   name: 'Basic Golang Producer (KAFKA)',
          //   value: 'producer',
          // },
        ]
      },
      {
        type: 'list',
        name: 'dependencytool',
        message: 'What type of dependency management tools do you want to use?',
        choices: [
          {
            name: 'golang/dep - (GO official experiment)',
            value: 'dep'
          },
          {
            name: 'glide',
            value: 'glide'
          }
        ],
        when: props => props.project.indexOf('console') === -1
      },
      {
        type: 'input',
        name: 'packagename',
        message: 'Please type your package name',
        default: 'test',
        when: props =>
          props.project.indexOf('gokitapi') !== -1 ||
          props.project.indexOf('restapi') !== -1
      },
      {
        type: 'checkbox',
        name: 'includeFiles',
        message: 'Which additional files would you like to include?',
        choices: [
          {
            name: '.gitignore',
            value: 'gitignore',
            checked: false
          },
          {
            name: 'Dockerfile',
            value: 'dockerfile',
            checked: false
          },
          {
            name: 'docker-compose',
            value: 'dockercompose',
            checked: false
          },
          {
            name: 'Makefile',
            value: 'makefile',
            checked: true
          },
          {
            name: 'README.md',
            value: 'readme',
            checked: false
          }
        ]
      }
    ];

    return this.prompt(prompts).then(props => {
      this.projectType = props.project;
      this.topicName = props.topicname;
      this.packageName = props.packagename;

      this.dependencyManagementTool =
        props.dependencytool === undefined || props.dependencytool === null
          ? ''
          : props.dependencytool;

      this.includeGitIgnore = _.includes(props.includeFiles, 'gitignore');
      this.includeDockerfile = _.includes(props.includeFiles, 'dockerfile');
      this.includeDockerCompose = _.includes(props.includeFiles, 'dockercompose');
      this.includeMakefile = _.includes(props.includeFiles, 'makefile');
      this.includeReadmeFile = _.includes(props.includeFiles, 'readme');
    });
  }

  writing() {
    switch (this.projectType) {
      case 'console':
        this.fs.copy(
          this.templatePath('console/_main.go'),
          this.destinationPath('main.go')
        );
        break;
      case 'restapi':
        this.fs.copyTpl(
          this.templatePath('restapi/_main.go'),
          this.destinationPath('main.go'),
          {
            repourl: this.repoUrl,
            projectname: this.projectName,
            packagename: this.packageName
          }
        );

        // Copy package name
        this.fs.copyTpl(
          this.templatePath(this.pathToTemplates + '/pkg-rest-endpoint/_handler.go'),
          this.destinationPath('./' + this.packageName + '/endpoint.go'),
          { projectname: this.projectName, packagename: this.packageName }
        );
        this.fs.copyTpl(
          this.templatePath(this.pathToTemplates + '/pkg-rest-endpoint/_interface.go'),
          this.destinationPath('./' + this.packageName + '/interface.go'),
          { projectname: this.projectName, packagename: this.packageName }
        );
        this.fs.copyTpl(
          this.templatePath(this.pathToTemplates + '/pkg-rest-endpoint/_model.go'),
          this.destinationPath('./' + this.packageName + '/model.go'),
          { projectname: this.projectName, packagename: this.packageName }
        );
        this.fs.copyTpl(
          this.templatePath(this.pathToTemplates + '/pkg-rest-endpoint/_repository.go'),
          this.destinationPath('./' + this.packageName + '/repository.go'),
          { projectname: this.projectName, packagename: this.packageName }
        );
        this.fs.copyTpl(
          this.templatePath(
            this.pathToTemplates + '/pkg-rest-endpoint/_service_tracing.go'
          ),
          this.destinationPath('./' + this.packageName + '/service_tracing.go'),
          { projectname: this.projectName, packagename: this.packageName }
        );
        this.fs.copyTpl(
          this.templatePath(this.pathToTemplates + '/pkg-rest-endpoint/_service.go'),
          this.destinationPath('./' + this.packageName + '/service.go'),
          { projectname: this.projectName, packagename: this.packageName }
        );
        break;
      default:
        this.log('nothing to do');
        break;
    }

    // Copy additional files
    this._copyAdditionalFiles();

    // Copy file of dependency tool
    this._copyFileDependencyTool();

    // Copy config package
    if (this.projectType !== 'console') {
      this._copyConfigPackage();
    }
  }

  _copyFileDependencyTool() {
    if (this.projectType !== 'console') {
      switch (this.dependencyManagementTool) {
        case 'glide':
          this.fs.copyTpl(
            this.templatePath(this.projectType + '/_glide.yaml'),
            this.destinationPath('glide.yaml'),
            { projectname: this.projectName, packagename: this.packageName }
          );
          break;
        case 'dep':
          this.fs.copyTpl(
            this.templatePath(this.projectType + '/_Gopkg.toml'),
            this.destinationPath('Gopkg.toml'),
            { projectname: this.projectName, packagename: this.packageName }
          );
          break;
        default:
          this.log('nothing to do');
          break;
      }
    }
  }

  _copyConfigPackage() {
    this.ConfigEnvVariables = [];
    var configTomlPath = this.destinationPath() + '/config.toml';

    // Read config.toml file if it's exist
    if (this.fs.exists(configTomlPath)) {
      try {
        this.ConfigEnvVariables = toml.parse(this.fs.read(configTomlPath));
      } catch (e) {
        this.log('\n');
        this.log(
          chalk.default.red(
            "ERROR : Your config toml file is not valid. 'generator-yogo' will create default config package."
          )
        );
        this.log('\n');
      }
    }

    var arrEnvKeys = Object.keys(this.ConfigEnvVariables);
    if (arrEnvKeys.length > 0) {
      // Copy from destination folder to ./config pkg
      this.fs.copy(
        this.destinationPath('./config.toml'),
        this.destinationPath('./config/config.toml')
      );
    } else {
      this.fs.copyTpl(
        this.templatePath(this.pathToTemplates + '/config/_config.toml'),
        this.destinationPath('./config/config.toml')
      );
    }

    this.fs.copyTpl(
      this.templatePath(this.pathToTemplates + '/config/_config_dynamic.toml.example'),
      this.destinationPath('./config/config.toml.example'),
      { envs: arrEnvKeys }
    );
    this.fs.copyTpl(
      this.templatePath(this.pathToTemplates + '/config/_config_dynamic.go'),
      this.destinationPath('./config/config.go'),
      { _: _, envs: arrEnvKeys }
    );
    this.fs.copyTpl(
      this.templatePath(this.pathToTemplates + '/config/_config_test.go'),
      this.destinationPath('./config/config_test.go')
    );
  }

  _copyAdditionalFiles() {
    if (this.includeGitIgnore) {
      this.fs.copyTpl(
        this.templatePath('_gitignore'),
        this.destinationPath('.gitignore'),
        { projectname: this.projectName }
      );
    }

    if (this.includeDockerfile) {
      this.fs.copyTpl(
        this.templatePath('_Dockerfile'),
        this.destinationPath('Dockerfile'),
        { projectname: this.projectName }
      );
    }

    if (this.includeDockerCompose) {
      this.fs.copyTpl(
        this.templatePath('_docker-compose.yml'),
        this.destinationPath('docker-compose.yml'),
        { projectname: this.projectName }
      );
    }

    if (this.includeMakefile) {
      this.fs.copyTpl(this.templatePath('_Makefile'), this.destinationPath('Makefile'), {
        projectname: this.projectName,
        dockerrun: this.docker_run,
        dependencytool: this.dependencyManagementTool
      });
    }

    if (this.includeReadmeFile) {
      this.fs.copyTpl(
        this.templatePath('_readme.md'),
        this.destinationPath('README.md'),
        { projectname: this.projectName }
      );
    }
  }

  end() {
    this.log('\n');
    this.log(
      '**********************************************************************************'
    );
    this.log(
      '* Your project is now created, you can use the following commands to get going   *'
    );
    this.log(
      '**********************************************************************************'
    );

    // Build end message content
    var filePath = this.templatePath('./' + this.projectType + '/_end_log.txt');
    var content = this.fs.read(filePath);
    var result = ejs.compile(content)({
      projectname: this.projectName,
      packagename: this.packageName,
      chalk: chalk,
      dependencytool: this.dependencyManagementTool
    });
    this.log(result);
  }
};
