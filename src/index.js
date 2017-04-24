import chokidar from 'chokidar';
import path from 'path';
import winston from 'winston';

import * as safejs from 'safe-js';

import fsp from 'fs-promise';

// Testing of Safejs against the real launcher.
const app =
{
    name: "safejs-jsfs",
    id: "safejsfs",
    version: "0.0.1",
    vendor: "josh wilson",
    permissions: ["SAFE_DRIVE_ACCESS"]
};



let token;


safejs.auth.authorise(app)
.then( authResponse => {

    console.log( "Auth response:", authResponse );
    token = authResponse.token;

})
.catch( err => winston.error( err ));



winston.cli();

const dir = 'safeDrive';

let watchDir = path.normalize( './', dir );

winston.info( 'we will watchDir' , watchDir );

var watcher = chokidar.watch( watchDir, {
    ignored: /[\/\\]\./, persistent: true
});

var log = winston.data;



const getFileTarget = ( filePath ) =>
{
    let pathInfo = path.parse( filePath );
    let fileName = pathInfo.base;
    let targetDir = pathInfo.dir;

    let cleanTargetDir = targetDir.replace( dir + '/', '' );


    return cleanTargetDir + fileName ;
}


async function addFile( filePath )
{
    log('File', filePath, 'has been added');

    let target = getFileTarget( filePath );
    let fileContents = await fsp.readFile( filePath );

    winston.info( '====>', target  );

    safejs.nfs.createFile( token, target, fileContents )
        .then( response =>
        {
            winston.log( "creating file", response );
        })
        .catch( err => winston.error( err.description ) );
}

async function createOrUpdate( filePath )
{
    log('File', filePath, 'has been changed');
    let target = getFileTarget( filePath );
    let fileContents = await fsp.readFile( filePath );

    safejs.nfs.createOrUpdateFile( token, target, fileContents )
        .then( response =>
        {
            console.log( "createOrUpdateFile existing file:", response );

            return response;
        });
}

watcher
    .on('add', addFile )
    .on('addDir', (filePath) =>
    {
        let target = getFileTarget( filePath );

        log('Directory', filePath, 'has been added');

        safejs.nfs.createDir( token, target )
            .then( response =>
            {
                winston.log( "createDir", response );
            });
    })
    .on('change', createOrUpdate )
    .on('unlink', (filePath) =>
    {
        log('File', filePath, 'has been removed');
        let target = getFileTarget( filePath );

        safejs.nfs.deleteFile( token, target )
            .then( response =>
            {
                console.log( "deleteFile:", response );
                return response;

            });
    })
    .on('unlinkDir', (filePath) =>
    {
        let target = getFileTarget( filePath );

        log('Directory', filePath, 'has been removed');

        safejs.nfs.deleteDir( token, target )
        .then( response =>
        {
            console.log( "deleteDir:", response );
            return response;

        });
    })
    .on('error', (error) =>
    {
        winston.error('Error happened', error);
    })
    // .on('moved', (filePath) =>
    // {
    //      currently not a thing
    //     winston.info('Renamed', filePath);
    // })
    .on('ready', () =>
    {
        winston.info('Initial scan complete. Ready for changes.');
    })
    .on('raw', (event, filePath, details) =>
    {
        log('Raw event info:', event, filePath, details);
    })

    // 'add', 'addDir' and 'change' events also receive stat() results as second
    // argument when available: http://nodejs.org/api/fs.html#fs_class_fs_stats
    watcher.on('change', function(filePath, stats) {
        if (stats) console.log('File', filePath, 'changed size to', stats.size);
    });
