'use strict';

/**
 * External Dependencies
 */
const { app, BrowserWindow } = require( 'electron' );
const { autoUpdater } = require( 'electron-updater' )
const debug = require( 'debug' )( 'desktop:updater:auto' );

/**
 * Internal dependencies
 */
const AppQuit = require( 'lib/app-quit' );
const Config = require( 'lib/config' );
const debugTools = require( 'lib/debug-tools' );
const { bumpStat, sanitizeVersion, getPlatform } = require( 'lib/desktop-analytics' );
const Updater = require( 'lib/updater' );

const statsPlatform = getPlatform( process.platform )
const sanitizedVersion = sanitizeVersion( app.getVersion() );

const getStatsString = ( isBeta ) => `${statsPlatform}${isBeta ? '-b' : ''}-${sanitizedVersion}`;

function dialogDebug( message ) {
	debug( message );

	if ( Config.build === 'updater' ) {
		debugTools.dialog( message );
	}
}

class AutoUpdater extends Updater {
	constructor( options = {} ) {
		super( options );

		autoUpdater.on( 'error', this.onError.bind( this ) );
		autoUpdater.on( 'update-available', this.onAvailable.bind( this ) );
		autoUpdater.on( 'update-not-available', this.onNotAvailable.bind( this ) );
		autoUpdater.on( 'update-downloaded', this.onDownloaded.bind( this ) );

		autoUpdater.autoInstallOnAppQuit = false;
		autoUpdater.allowDowngrade = true;
		autoUpdater.channel = 'stable';
		autoUpdater.allowPrerelease = false;

		if ( this.beta ) {
			autoUpdater.channel = 'beta';
			autoUpdater.allowPrerelease = true;
			autoUpdater.allowDowngrade = false;
		}
	}

	ping() {
		dialogDebug( 'Checking for update' );
		autoUpdater.checkForUpdates();
	}

	onAvailable( info ) {
		debug( 'New update is available', info.version )
		bumpStat( 'wpcom-desktop-update-check', `${getStatsString( this.beta )}-needs-update` );
	}

	onNotAvailable() {
		debug( 'No update is available' )
		bumpStat( 'wpcom-desktop-update-check', `${getStatsString( this.beta )}-no-update` );
	}

	onDownloaded( info ) {
		debug( 'Update downloaded', info.version );

		this.setVersion( info.version );
		this.notify();

		const stats = {
			'wpcom-desktop-download': `${statsPlatform}-app`,
			'wpcom-desktop-download-by-ver': `${statsPlatform}-app-${sanitizedVersion}`,
			'wpcom-desktop-download-ref': `update-${statsPlatform}-app`,
			'wpcom-desktop-download-ref-only': 'update',
		}
		bumpStat( stats );
	}

	onConfirm() {
		AppQuit.allowQuit();

		// Ref: https://github.com/electron-userland/electron-builder/issues/1604
		app.removeAllListeners( 'window-all-closed' );
		const windows = BrowserWindow.getAllWindows();
		for ( let i = 0; i < windows.length; i++ ) {
			const window = windows[i];
			window.close()
		}

		// Ref: https://github.com/electron-userland/electron-builder/issues/4143#issuecomment-521850797
		app.autoInstallOnAppQuit = true;
		autoUpdater.quitAndInstall();
		app.quit();

		bumpStat( 'wpcom-desktop-update', `${getStatsString( this.beta )}-confirm` );
	}

	onCancel() {
		bumpStat( 'wpcom-desktop-update', `${getStatsString( this.beta )}-update-cancel` );
	}

	onError( event ) {
		debug( 'Update error', event );

		bumpStat( 'wpcom-desktop-update', `${getStatsString( this.beta )}-update-error` );
	}
}

module.exports = AutoUpdater;
