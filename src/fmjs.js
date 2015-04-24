/**
 * This file manager module takes care of all file reading and saving operations
 * on diverse filesystems, including cloud uploading/downloading operations as
 * well as reading/writing the HTML5 sandboxed file system.
 *
 * FEATURES
 * - Read/write files from/to HTML5 sandboxed file system
 * - Upload/Download files from the cloud
 *
 * TECHNOLOGY
 * - HTML5 filesystem API
 * - Google drive API
 */

/**
 * Provide a namespace for the file manager module
 *
 * @namespace
 */
var fmjs = fmjs || {};

  /**
   * Generic abstract method
   *
   * @function
   */
  fmjs.abstractmethod = function() {
    throw new Error('abstract method');
  };

  /**
   * Abstract class defining a file manager's interface
   *
   * @interface
   */
  fmjs.AbstractFileManager = function() {
    throw new Error('Can not instantiate abstract classes');
  };

  fmjs.AbstractFileManager.prototype.requestFileSystem = fmjs.abstractmethod;

  fmjs.AbstractFileManager.prototype.isFile = fmjs.abstractmethod;

  fmjs.AbstractFileManager.prototype.readFile = fmjs.abstractmethod;

  fmjs.AbstractFileManager.prototype.writeFile = fmjs.abstractmethod;

  fmjs.AbstractFileManager.prototype.createPath = fmjs.abstractmethod;


  /**
   * Concrete class implementing a file manager for the local FS.
   * Currently uses the HTML5's sandboxed FS API (only implemented in Chrome)
   *
   * @constructor
   * @extends {fmjs.AbstractFileManager}
   */
  fmjs.LocalFileManager = function() {

    // local filesystem object
    this.fs = null;

  };

  /**
   * fmjs.LocalFileManager class inherits from fmjs.AbstractFileManager class
   */
  fmjs.LocalFileManager.prototype = Object.create(fmjs.AbstractFileManager.prototype);
  fmjs.LocalFileManager.prototype.constructor = fmjs.LocalFileManager;

  /**
   * Request sandboxed filesystem
   *
   * @param {Function} callback to be called when the API is ready.
   */
  fmjs.LocalFileManager.prototype.requestFileSystem = function(callback) {
    var self = this;

    // The file system has been prefixed as of Google Chrome 12:
    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    // Request 5GB
    /*window.webkitStorageInfo.requestQuota( PERSISTENT, 5*1024*1024*1024, function(grantedBytes) {
      window.requestFileSystem(PERSISTENT, grantedBytes, function(fs){self.fs = fs;}, self.fsErrorHandler);
    }, function(err) {
      window.console.log('Error', err);} ); */
    if (window.requestFileSystem) {
      window.requestFileSystem(window.TEMPORARY, 5*1024*1024*1024, function(fs){
        self.fs = fs;
        callback();
      }, function(err) {throw new Error('Could not grant filesystem. Error code: ' + err.code);});
    }

  };

  /**
   * Create a new directory path in the sandboxed FS
   *
   * @param {String} new absolute path to be created.
   * @param {Function} optional callback whose argument is the directory entry or
   * null otherwise.
   */
  fmjs.LocalFileManager.prototype.createPath = function(path, callback) {
    var self = this;

    function createPath() {

      function createFolder(rootDirEntry, folders) {

        function errorHandler(err) {
          window.console.log('Could not create path. Error code: ' + err.code);
          if (callback) {
            callback(null);
          }
        }

        // exclusive:false means if the folder already exists then don't throw an error
        rootDirEntry.getDirectory(folders[0], {create: true, exclusive:false}, function(dirEntry) {
          // Recursively add the new subfolder (if we still have another to create).
          folders = folders.slice(1);
          if (folders.length) {
            createFolder(dirEntry, folders);
          } else if (callback) {
            callback(dirEntry);
          }
        }, errorHandler);

      }

      var folders = fmjs.path2array(path);
      createFolder(self.fs, folders); // fs.root is a DirectoryEntry

    }

    if (this.fs) {
      createPath();
    } else {
      this.requestFileSystem(createPath);
    }

  };

  /**
   * Determine whether a file exists in the sandboxed FS
   *
   * @param {String} file's path.
   * @param {Function} callback whose argument is the File object if found or
   * null otherwise.
   */
  fmjs.LocalFileManager.prototype.isFile = function(filePath, callback) {
    var self = this;

    function findFile() {

      function errorHandler(err) {
        window.console.log('File not found. Error code: ' + err.code);
        callback(null);
      }

      self.fs.root.getFile(filePath, {create: false}, function(fileEntry) {
        // Get a File object representing the file,
        fileEntry.file(function(fileObj) {
          callback(fileObj);
        }, errorHandler);
      }, errorHandler);
    }

    if (this.fs) {
      findFile();
    } else {
      this.requestFileSystem(findFile);
    }

  };

  /**
   * Read a file from the sandboxed FS
   *
   * @param {String} file's path.
   * @param {Function} callback whose argument is an ArrayBuffer object containing
   * the file data if the file is successfuly read or null otherwise.
   */
  fmjs.LocalFileManager.prototype.readFile = function(filePath, callback) {
    var self = this;

    function readFile() {

      function errorHandler(err) {
        window.console.log('Could not read file. Error code: ' + err.code);
        callback(null);
      }

      self.fs.root.getFile(filePath, {create: false}, function(fileEntry) {
        // Get a File object representing the file,
        fileEntry.file(function(fileObj) {
          var reader = new FileReader();

          reader.onload = function() {
            callback(this.result);
          };

          reader.readAsArrayBuffer(fileObj);
        }, errorHandler);
      }, errorHandler);

    }

    if (this.fs) {
      readFile();
    } else {
      this.requestFileSystem(readFile);
    }

  };

  /**
   * Write a file to the sandboxed FS
   *
   * @param {String} file's path.
   * @param {Array} ArrayBuffer object containing the file data.
   * @param {Function} optional callback whose argument is the File object or
   * null otherwise.
   */
  fmjs.LocalFileManager.prototype.writeFile = function(filePath, fileData, callback) {
    var self = this;

    function checkPathAndWriteFile() {

      function errorHandler(err) {
        window.console.log('Could not write file. Error code: ' + err.code);
        if (callback) {
          callback(null);
        }
      }

      function writeFile() {
        self.fs.root.getFile(filePath, {create: true}, function(fileEntry) {
          // Create a FileWriter object for our FileEntry (filePath).
          fileEntry.createWriter(function(fileWriter) {

            fileWriter.onwrite = function() {
              if (callback) {
                // Get a File object representing the file,
                fileEntry.file(function(fileObj) {
                  callback(fileObj);
                }, errorHandler);
              }
            };

            fileWriter.onerror = function(err) {
              window.console.log('Could not write file. Error code: ' + err.toString());
              if (callback) {
                callback(null);
              }
            };

            var bBuilder = new BlobBuilder();
            bBuilder.append(fileData);
            var dataBlob = bBuilder.getBlob();
            fileWriter.write(dataBlob);

          }, errorHandler);
        }, errorHandler);
      }

      var basedir = filePath.substring(0, filePath.lastIndexOf('/'));
      self.fs.getDirectory(basedir, {create: false}, function() {
        writeFile();
      }, function (err) {if (err.code === FileError.NOT_FOUND_ERR) {
        self.createPath(basedir, writeFile);} else {
          errorHandler(err);
        }} );
    }

    if (this.fs) {
      checkPathAndWriteFile();
    } else {
      this.requestFileSystem(checkPathAndWriteFile);
    }

  };


  /**
   * Concrete class implementing a file manager for Google Drive.
   * Uses Google Drive's API
   *
   * @constructor
   * @extends {fmjs.AbstractFileManager}
   * @param {String} Client ID from the Google's developer console.
   */
  fmjs.GDriveFileManager = function(clientId) {
    // Google's ID for the client app
    this.CLIENT_ID = clientId;
    // Permissions to access files uploaded through the API
    this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
    // Has OAuth 2.0 client library been loaded?
    this.clientOAuthAPILoaded = false;
    // Has the client app been authorized?
    this.autorized = false;
    // Has Google Drive API been loaded?
    this.driveAPILoaded = false;
    // Current user information (name, email)
    this.userInfo = null;

  };

  /**
   * fmjs.GDriveFileManager class inherits from fmjs.AbstractFileManager class
   */
  fmjs.GDriveFileManager.prototype = Object.create(fmjs.AbstractFileManager.prototype);
  fmjs.GDriveFileManager.prototype.constructor = fmjs.GDriveFileManager;

  /**
   * Check if the current user has authorized the application and then load the GDrive Api.
   *
   * @param {Boolean} whether or not to open a popup window.
   * @param {Function} callback whose argument is a boolean true if success
   */
  fmjs.GDriveFileManager.prototype.requestFileSystem = function(immediate, callback) {
    var self = this;

    function requestFS() {
      if (!self.authorized) {
        gapi.auth.authorize({'client_id': self.CLIENT_ID, 'scope': self.SCOPES, 'immediate': immediate},
          function(authResult) {
            if (authResult && !authResult.error) {
              self.authorized = true;
              self.loadGDriveApi(callback);
            } else {
              callback(false);
            }
        });
      } else{
        self.loadGDriveApi(callback);
      }
    }

    if (this.clientOAuthAPILoaded) {
      requestFS();
    } else {
      gapi.load('auth:client', requestFS);
    }

  };

  /**
   * Load GDrive API if the client app has been authorized
   *
   * @param {Function} callback whose argument is a boolean true if the api is successfuly loaded
   */
   fmjs.GDriveFileManager.prototype.loadGDriveApi = function(callback) {
     var self = this;

     if (this.authorized) {
       if (!this.driveAPILoaded) {
         gapi.client.load('drive', 'v2', function() {
           self.driveAPILoaded = true;
           callback(true);
         });
       }
     } else {
       console.error("The app has not been authorized");
     }
   };

  /**
   * Create a new directory path in the GDrive cloud
   *
   * @param {String} new absolute path to be created.
   * @param {Function} optional callback whose argument is the folder creation
   * response object or null otherwise.
   */
  fmjs.GDriveFileManager.prototype.createPath = function(path, callback) {

    function createFolder(rootResp, folders) {
      // list folder with name folders[0] if it already exists
      var findRequest = gapi.client.drive.children.list({
        'folderId': rootResp.id,
        'q': "mimeType='application/vnd.google-apps.folder' and title='" + folders[0] + "'"
        });

      findRequest.execute(function(findResp) {
        // if folder not found then create it
        if (findResp.items.length===0) {
          var request = gapi.client.drive.files.insert({
            'resource': {'title': folders[0], 'mimeType': 'application/vnd.google-apps.folder', 'parents': [{'id': rootResp.id}]}
          });

          request.execute(function(resp) {
            folders = folders.slice(1);
            if (folders.length) {
              //recursively create subsequent folders if needed
              createFolder(resp, folders);
            } else if (callback) {
              callback(resp);
            }
          });

        } else {
          folders = folders.slice(1);
          if (folders.length) {
            // recursively create subsequent folders if needed
            createFolder(findResp.items[0], folders);
          } else if (callback) {
            callback(findResp.items[0]);
          }
        }
      });
    }

    if (this.driveAPILoaded) {
      var folders = fmjs.path2array(path);
      if (folders.length) {
        createFolder({'id': 'root'}, folders);
      } else if (callback) {
        callback(null);
      }
    } else {
      console.error("GDrive Api not loaded");
    }

  };

  /**
   * Determine whether a file exists in the GDrive cloud
   *
   * @param {String} file's path.
   * @param {Function} callback whose argument is the file response object if
   * found or null otherwise.
   */
  fmjs.GDriveFileManager.prototype.isFile = function(filePath, callback) {

    function findEntry(rootResp, entries) {
      var findRequest;

      // list entry with name entry[0] if it exists. The search request depends
      // on whether we are at the filename entry or at an ancestor folder
      if (entries.length===1) {
        findRequest = gapi.client.drive.children.list({
          'folderId': rootResp.id,
          'q': "mimeType!='application/vnd.google-apps.folder' and title='" + entries[0] + "'"
        });
      } else {
        findRequest = gapi.client.drive.children.list({
          'folderId': rootResp.id,
          'q': "mimeType='application/vnd.google-apps.folder' and title='" + entries[0] + "'"
        });
      }

      findRequest.execute(function(findResp) {

        if (findResp.items.length===0) {

          console.error('File ' + filePath + ' not found!');
          if (callback) {
            callback(null);
          }

        } else {

          // Entry was found! Check if there are more entries
          entries = entries.slice(1);
          if (entries.length) {
            // Recursively move to subsequent entry
            findEntry(findResp.items[0], entries);
          } else if (callback) {
            // No more entries, current entry is the file
            // Request file response object (resource)
            var request = gapi.client.drive.files.get({
              'fileId': findResp.items[0].id
            });
            request.execute(function(resp) {
              callback(resp);
            });
          }

        }

      });
    }

    if (this.driveAPILoaded) {
      var entries = fmjs.path2array(filePath);
      if (entries.length) {
        findEntry({'id': 'root'}, entries);
      } else if (callback) {
        callback(null);
      }
    } else {
      console.error("GDrive Api not loaded");
    }

  };

  /**
   * Read a file from the GDrive cloud
   *
   * @param {String} file's path.
   * @param {Function} callback whose argument is the file data if the file is
   * successfuly read or null otherwise.
   */
  fmjs.GDriveFileManager.prototype.readFile = function(filePath, callback) {

    this.isfile(filePath, function(fileResp) {

      if (fileResp) {
        var accessToken = gapi.auth.getToken().access_token;
        var xhr = new XMLHttpRequest();

        xhr.open('GET', fileResp.downloadUrl);
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

        // Response handlers.
        xhr.onload = function() {
          // convert from base 64 encoded string to ArrayBuffer
          var fileData = fmjs.str2ab(atob(xhr.responseText));
          callback(fileData);
        };

        xhr.onerror = function() {
            window.console.log('Could not read file: ' + fileResp.title + ' with id: ' + fileResp.id);
            callback(null);
        };

        xhr.send();

      } else {
        callback(null);
      }

    });

  };

  /**
   * Given a file id read the file from the GDrive cloud if authorized. Can read
   * a file from another user's GDrive if read permission has been granted to the
   * current user.
   *
   * @param {String} file's id.
   * @param {Function} callback whose argument is the file data if the file is
   * successfuly read or null otherwise.
   */
  fmjs.GDriveFileManager.prototype.readFileByID = function(fileID, callback) {
    var self = this;

    if (this.driveAPILoaded) {
      var copyRequest = gapi.client.drive.files.copy({
        'fileId': fileID,
        'resource': {'title': 'tempGDriveFile.tmp'}
      });

      copyRequest.execute(function(copyResp) {

        self.readFile('tempGDriveFile.tmp', function (dataResp) {
          // Permanently delete the temporal file, skipping the trash.
          var delRequest = gapi.client.drive.files.delete({
            'fileId': copyResp.id
          });
          delRequest.execute(function(delResp) { window.console.log(delResp);});

          callback(dataResp);
        });

      });
    } else {
      console.error("GDrive Api not loaded");
    }

  };

  /**
   * Write a file to GDrive
   *
   * @param {String} file's path.
   * @param {Array} ArrayBuffer object containing the file data.
   * @param {Function} optional callback whose argument is the file response object.
   */
  fmjs.GDriveFileManager.prototype.writeFile = function(filePath, fileData, callback) {

    // callback to insert new file.
    function writeFile(baseDirResp) {

      var boundary = '-------314159265358979323846';
      var delimiter = "\r\n--" + boundary + "\r\n";
      var close_delim = "\r\n--" + boundary + "--";

      var contentType = fileData.type || 'application/octet-stream';
      var name = fileData.name || filePath.substring(filePath.lastIndexOf('/') + 1);
      var metadata = {
        'title': name,
        'mimeType': contentType,
        'parents': [{'id': baseDirResp.id}]
      };

      var base64Data = btoa(fmjs.ab2str(fileData));
      var multipartRequestBody =
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: ' + contentType + '\r\n' +
          'Content-Transfer-Encoding: base64\r\n' +
          '\r\n' +
          base64Data +
          close_delim;

      var request = gapi.client.request({
          'path': '/upload/drive/v2/files',
          'method': 'POST',
          'params': {'uploadType': 'multipart' /*resumable for more than 5MB files*/},
            'headers': {
              'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody});
      if (!callback) {
        callback = function(fileResp) {
          window.console.log(fileResp);
        };
      }
      request.execute(callback);

    }

    var basedir = filePath.substring(0, filePath.lastIndexOf('/'));
    this.createPath(basedir, writeFile);
  };

  /**
   * Share a file in current users's GDrive with another GDrive user identified
   * by it's email address.
   *
   * @param {String} file's path.
   * @param {Function} optional callback whose argument is the shared file
   * response object if found or null otherwise.
   */
  fmjs.GDriveFileManager.prototype.shareFile = function(filePath, userMail, callback) {

    this.isfile(filePath, function (fileResp) {

      if (fileResp) {
        var request = gapi.client.drive.permissions.insert({
          'fileId': fileResp.id,
          'resource': {'value': userMail, 'type': 'user', 'role': 'reader'}
          });
        request.execute(function(resp) {if (callback) {callback(resp);}});
      } else if (callback) {
        callback(null);
      }

    });

  };

  /**
   * Get information about current GDrive user.
   *
   * @param {Function} optional callback whose argument is an object with the user
   * info (properties: name, emailAddress).
   */
  fmjs.GDriveFileManager.prototype.getUserInfo = function(callback) {
    var self = this;

    if (this.userInfo) {
      callback(this.userInfo);
    } else {
      var request = gapi.client.drive.about.get();
      request.execute(function(resp) {
        var userDataObj = {name: resp.name, emailAddress: resp.user.emailAddress};
        self.userInfo = userDataObj;
        callback(userDataObj);
      });
    }

  };


  /**
   * Concrete class implementing a file manager for Dropbox.
   * Uses Dropbox API
   *
   * @constructor
   * @extends {fmjs.AbstractFileManager}
   */
  //fmjs.DropboxFileManager = function() {


  //};

  /**
   * fmjs.DropboxFileManager class inherits from fmjs.AbstractFileManager class
   */
  //fmjs.DropboxFileManager.prototype = Object.create(fmjs.AbstractFileManager.prototype);
  //fmjs.DropboxFileManager.prototype.constructor = fmjs.DropboxFileManager;

  /**
   * Load Dropbox API
   *
   * @param {Function} callback to be called when the API is ready.
   */
  //fmjs.DropboxFileManager.prototype.requestFileSystem = function(callback) {

  //};

  /**
   * Create a new directory path in the Dropbox cloud
   *
   * @param {String} new absolute path to be created.
   * @param {Function} optional callback whose argument is the folder creation
   * response object or null otherwise.
   */
  //fmjs.DropboxFileManager.prototype.createPath = function(path, callback) {

  //};

  /**
   * Determine whether a file exists in the Dropbox cloud
   *
   * @param {String} file's path.
   * @param {Function} callback whose argument is the file response object if
   * found or null otherwise.
   */
  //fmjs.DropboxFileManager.prototype.isFile = function(filePath, callback) {

  //};

  /**
   * Read a file from the Dropbox cloud
   *
   * @param {String} file's path.
   * @param {Function} callback whose argument is the file data if the file is
   * successfuly read or null otherwise.
   */
  //fmjs.DropboxFileManager.prototype.readFile = function(filePath, callback) {

  //};

  /**
   * Write a file to Dropbox
   *
   * @param {String} file's path.
   * @param {Array} ArrayBuffer object containing the file data.
   * @param {Function} optional callback whose argument is the response object.
   */
  //fmjs.DropboxFileManager.prototype.writeFile = function(filePath, fileData, callback) {

  //};


  /**
   * Convert ArrayBuffer to String
   *
   * @function
   * @param {Array} input ArrayBuffer.
   * @return {string} the resulting string.
   */
  fmjs.ab2str = function(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf)); // 1 byte for each char
  };

  /**
   * Convert String to ArrayBuffer
   *
   * @function
   * @param {String} input string.
   * @return {Array} the resulting array.
   */
  fmjs.str2ab = function(str) {
    // 1 byte for each char
    var buf = new ArrayBuffer(str.length);
    var bufView = new Uint8Array(buf);

    for (var i=0, strLen=str.length; i<strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  };

  /**
   * Split a file or folder path into an array
   *
   * @function
   * @param {String} input path.
   * @return {Array} the resulting array.
   */
  fmjs.path2array = function(path) {
    var entries = path.split('/');
    // Throw out './' or '/' and move on to prevent something like '/foo/.//bar'.
    if (entries[0] === '.' || entries[0] === '') {
      entries = entries.slice(1);
    }
    return entries;
  };
