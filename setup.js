var path = process.env.npm_package_config_plugins;

function init() {
	if (!path || (path = '')) {
		console.log('Plugins configuration does not exists');
		console.log('You can configure it using the following command');
		console.log('npm config set oodebe:plugins <dir_name>');
		return;
	}
	
	var fs = require('fs');
	path = path + '\\oodebe_plugins\\';
	if (fs.existsSync(path)) {
		console.log('Plugins directory already exists in "' + path + '"');
		return;
	}
	
	fs.mkdirSync(path);
	
	// var AdmZip = require('adm-zip');
	// var zip = new AdmZip(__dirname + '\\sample.zip');
	// zip.extractAllTo(path);
}

// function download (file_url, path) {
	// var file_name = url.parse(file_url).pathname.split('/').pop();
	// var wget = 'wget -P ' + path + ' ' + file_url;

	// var child = exec(wget, function(err, stdout, stderr) {
		// if (err)
			// throw err;
		// else
			// console.log(file_name + ' downloaded to ' + path);
	// });
// };