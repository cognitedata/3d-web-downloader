## Cognite REVEAL viewer downloader
A small script that can be used to download Cognite 3D REVEAL viewer files to run locally.

# How to install
You will need `yarn` or `npm` to install dependencies.
`git clone git@github.com:cognitedata/3d-web-downloader.git`
Run `yarn` or `npm install` to install dependencies.

# How to run
`node index.js -a APIKEY -p PROJECT -m MODELID -r REVISIONID -d /path/to/store/files`

The `/path/to/store/files` should be a directory that is accessible through your web server. 
Assuming that you run your application so it's available at `localhost:8080`, you can test if your files are available by opening `localhost:8080/files/uploaded_files.txt` (the file may be empty, but will always exist).

# How to use with Cognite 3D REVEAL viewer
If your files are accessible from `localhost:8080/files`, you can load in the Cognite 3D REVEAL viewer by doing

```js
const viewer = new Cognite3DViewer();
const options = {
  localPath: 'files'
}
viewer.addModel(options).then(model => {
  // Do stuff with model.
});
```