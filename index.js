const cogniteParser = require("@cognite/3d-web-parser");
const cogniteSdk = require("@cognite/sdk");
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const async = require("async");
const ArgumentParser = require('argparse').ArgumentParser;

const main = async () => {
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
  argParser.addArgument([ '--maxversion' ],{ help: 'Max supported file version', defaultValue: 3});
  var args = argParser.parseArgs();

  const sdk = new cogniteSdk.CogniteClient({appId: '3d-web-downloader'});
  sdk.loginWithApiKey({
    project: args.project,
    apiKey: args.apikey,
  });

  const downloadAndSaveFile = async function(fileId, filePath) {
    console.log("Downloading and saving", fileId, "to", filePath);
    const buffer = await sdk.files3D.retrieve(fileId);

    fs.writeFile(filePath, buffer, err => {
      if (err) {
        console.log('Error, could not write to file ', filePath);
        exit(1);
      }
      console.log('Saved file ', filePath);
    });

    // workaround for buffers in Node
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    return arrayBuffer;
  }

  const revision = await sdk.viewer3D.retrieveRevealRevision3D(args.modelid, args.revisionid);
  console.log("Available files:", revision.sceneThreedFiles);
  const sceneFile = revision.sceneThreedFiles
  .filter(file => file.version <= args.maxversion)
  .sort((a, b) => a.version < b.version)[0];
  console.log("Chosen file:", sceneFile);

  const sceneFileName = sceneFile.version >= 4 ? `web_scene_${sceneFile.version}.i3d` : `web_scene_${sceneFile.version}.pb`;
  console.log(`Downloading file version ${sceneFile.version} with fileId ${sceneFile.fileId}`);

  let filePath = path.join(args.directory, sceneFileName);
  const sceneBuffer = await downloadAndSaveFile(sceneFile.fileId, filePath);

  const { rootSector, sectors, sceneStats, maps } = sceneFile.version >= 4 ? cogniteParser.parseFullCustomFile(sceneBuffer, null) : await cogniteParser.parseProtobuf(new Uint8Array(sceneBuffer));

  const fileIds = new Set();
  for(var sector of rootSector.traverseSectors()) {
    sector.instancedMeshGroup.meshes.map(mesh => {
      fileIds.add(Number(mesh.fileId))
    });

    sector.mergedMeshGroup.meshes.map(mesh => {
      fileIds.add(Number(mesh.fileId))
    });
  }

  const result = await async.eachLimit(fileIds, 10, async function(fileId, callback) {
    const filePath = path.join(args.directory, fileId.toString());
    await downloadAndSaveFile(fileId, filePath);
  }, function(err){
  });

  const fileMapData = Array.from(fileIds).map(fileId => `${fileId}	${fileId}`).join('\n');

  console.log("Downloading individual sectors");

  // TODO parallelize by creating a list of sectors and then starting individual downloads
  let cursor;
  do {
    const result = await sdk.viewer3D.listRevealSectors3D(args.modelid, args.revisionid, {
      cursor
    });
    for (sector of result.items) {
      const sectorFile = revision.sceneThreedFiles
      .filter(file => file.version <= args.maxversion)
      .sort((a, b) => a.version < b.version)[0];
      const filePath = path.join(args.directory, sectorFile.fileId.toString());
      await downloadAndSaveFile(sectorFile.fileId, filePath);
    }
    cursor = result.nextCursor;
  } while (cursor !== undefined);

  filePath = path.join(args.directory, 'uploaded_files.txt');
  fs.writeFile(filePath, fileMapData, err => {
    if (err) {
      console.log('Error, could not write to file ', filePath);
      exit(1);
    }
    console.log('Saved file ', filePath);
  });
};

main();
