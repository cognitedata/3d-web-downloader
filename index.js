const cogniteParser = require("@cognite/3d-web-parser");
const sdk = require("@cognite/sdk");
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const async = require("async");
const ArgumentParser = require('argparse').ArgumentParser;
const argParser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'Cognite 3D web downloader'
});
argParser.addArgument([ '-a', '--apikey' ],{ help: 'Api key for your project', required: true});
argParser.addArgument([ '-p', '--project' ],{ help: 'Project / tenant name', required: true});
argParser.addArgument([ '-m', '--modelid' ],{ help: 'Model id', required: true});
argParser.addArgument([ '-r', '--revisionid' ],{ help: 'Revision id', required: true});
argParser.addArgument([ '-d', '--directory' ],{ help: 'Target directory', required: true});
var args = argParser.parseArgs();

sdk.configure({
  project: args.project,
  apiKey: args.apikey,
});

const downloadAndSaveFile = async function(fileId, filePath) {
  const buffer = await sdk.ThreeD.retrieveFile(fileId, "arraybuffer");

  fs.writeFile(filePath, buffer, err => {
    if (err) {
      console.log('Error, could not write to file ', filePath);
      exit(1);
    }
    console.log('Saved file ', filePath);
  });

  return buffer;
}

sdk.ThreeD.retrieveRevision(args.modelid, args.revisionid).then(async revision => {
  const sceneFileVersion = revision.sceneThreedFiles[revision.sceneThreedFiles.length - 1].version;
  const sceneFileId = revision.sceneThreedFiles[revision.sceneThreedFiles.length - 1].fileId;
  const sceneFileName = sceneFileVersion >= 4 ? `web_scene_${sceneFileVersion}.i3d` : `web_scene_${sceneFileVersion}.pb`;
  console.log(`Downloading file version ${sceneFileVersion} with fileId ${sceneFileId}`);

  let filePath = path.join(args.directory, sceneFileName);
  const sceneBuffer = await downloadAndSaveFile(sceneFileId, filePath);
  
  const { rootSector, sectors, sceneStats, maps } =
  sceneFileVersion >= 4
    ? cogniteParser.parseFullCustomFile(sceneBuffer.buffer, null)
    : cogniteParser.parseProtobuf(new Uint8Array(sceneBuffer), false);

  const fileIds = new Set();
  for(var sector of rootSector.traverseSectors()) {
    sector.instancedMeshGroup.meshes.map(mesh => {
      fileIds.add(mesh.fileId)
    });
    
    sector.mergedMeshGroup.meshes.map(mesh => {
      fileIds.add(mesh.fileId)
    });
  }

  async.eachLimit(fileIds, 10, function(fileId, callback) {
    const filePath = path.join(args.directory, fileId.toString());
    downloadAndSaveFile(fileId, filePath);
    }, function(err){
  });

  const fileMapData = Array.from(fileIds).map(fileId => `${fileId} ${fileId}`).join('\n');

  filePath = path.join(args.directory, 'uploaded_files.txt');
  fs.writeFile(filePath, fileMapData, err => {
    if (err) {
      console.log('Error, could not write to file ', filePath);
      exit(1);
    }
    console.log('Saved file ', filePath);
  });
})
