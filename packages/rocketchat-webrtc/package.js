Package.describe({
	name: 'rocketchat:webrtc',
	version: '0.0.1',
	summary: 'Package WebRTC for Meteor server',
	git: '',
});

Package.onUse(function(api) {
<<<<<<< HEAD
	api.use('rocketchat:lib');
	api.use('ecmascript');

	api.use('templating', 'client');
	api.mainModule('client/WebRTCClass.js', 'client');
	api.addFiles('client/adapter.js', 'client');
	// api.addFiles(');
	api.addFiles('client/screenShare.js', 'client');

	api.addFiles('server/settings.js', 'server');

	api.export('WebRTC', 'client');
=======
	api.use([
		'ecmascript',
		'rocketchat:utils',
		'rocketchat:ui-utils',
		'rocketchat:notifications',
		'rocketchat:settings',
		'rocketchat:models',
		'templating',
	]);
	api.mainModule('client/index.js', 'client');
	api.mainModule('server/index.js', 'server');
>>>>>>> 9d7d2705b884d01ccff402c26cd9e38006181825
});
