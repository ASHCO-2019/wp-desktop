'use strict';

/**
 * External Dependencies
 */
const path = require( 'path' );
const app = require( 'electron' ).app;
const { mkdirSync } = require( 'fs' );

/**
 * Initialize core components
 */

const state = require( './lib/state' );
const config = require( './lib/config' );
const appData = path.join( app.getPath( 'appData' ), config.appPathName );

// Initialize log directory prior to requiring any modules that log
const logPath = process.env.WP_DEBUG_LOG ? process.env.WP_DEBUG_LOG : path.join( appData, 'logs', 'wp-desktop.log' );
try {
	mkdirSync( path.dirname( logPath ), { recursive: true } );
} catch ( err ) {
	if ( err.code !== 'EEXIST' ) {
		throw err;
	}
}
state.setLogPath( logPath );

// Initialize settings
const Settings = require( './lib/settings' );

// Catch-all error handler
// We hook in very early to catch issues during the startup process
require( './app-handlers/exceptions' )();

// if app path set to asar, switch to the dir, not file
var apppath = app.getAppPath();
if ( path.extname( apppath ) === '.asar' ) {
	apppath = path.dirname( apppath );
}
process.chdir( apppath );

process.env.CALYPSO_ENV = config.calypso_config;

// Set app config path
app.setPath( 'userData', appData );

if ( Settings.isDebug() ) {
	process.env.DEBUG = config.debug.namespace;
}

/**
 * These setup things for Calypso. We have to do them inside the app as we can't set any env variables in the packaged release
 * This has to come after the DEBUG_* variables
 */
const debug = require( 'debug' )( 'desktop:boot' );
debug( '========================================================================================================' );
debug( config.name + ' v' + config.version );
debug( 'Path:', app.getAppPath() );
debug( 'Server: ' + config.server_url + ':' + config.server_port );
debug( 'Settings:', Settings._getAll() );

if ( Settings.getSetting( 'proxy-type' ) === '' ) {
	debug( 'Proxy: none' );
	app.commandLine.appendSwitch( 'no-proxy-server' );
} else if ( Settings.getSetting( 'proxy-type' ) === 'custom' ) {
	debug( 'Proxy: ' + Settings.getSetting( 'proxy-url' ) + ':' + Settings.getSetting( 'proxy-port' ) );
	app.commandLine.appendSwitch( 'proxy-server', Settings.getSetting( 'proxy-url' ) + ':' + Settings.getSetting( 'proxy-port' ) );

	if ( Settings.getSetting( 'proxy-pac' ) !== '' ) {
		debug( 'Proxy PAC: ' + Settings.getSetting( 'proxy-pac' ) );

		// todo: this doesnt seem to work yet
		app.commandLine.appendSwitch( 'proxy-pac-url', Settings.getSetting( 'proxy-pac' ) );
	}
}

debug( '========================================================================================================' );

// Define a global 'desktop' variable that can be used in browser windows to access config and settings
global.desktop = {
	config: config,
	settings: Settings,
};
