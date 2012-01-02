#Oodebe

Oodebe is an asynchronous I/O based framework built on node.js for providing a consistent client (REST) API 
for synchronizing operations on one or more back-end server modules.


* Provides facilities to develop, test and deploy a REST API server
* Each API call can be constructed as a script
* Scripts can be executed as either native node.js scripts or one of the supported plugins
* Plugins allow scripts to access various REST servers such as Neo4j, SOLR, MongoDB, and Lily using their REST interface
* Additional plugins can be written in the form of simple JSON configuration files

## Files and Folders

Oodebe includes the following files and folders to provide its functionality

### Files

####index.js:
Contains all the library functions of oodebe which are used in different level of processing over various inputs. 
It also initializes the REST API server and provides support for the developer console.

####config.js:
This is the configuration file that contains all the configuration paramters for the oodebe server. See the Configuration section below for details.

####tmpl.js:
This is a support library used to implement template tags support.

####user.db:
This is a file containing all users for the developer console. Only user accounts created through the registration facility in the developer console shall be allowed to use the console.





###Folders:



####html :
Contain the html files for the developer console in the oodebe server.

####js :
Contain the javascript files that are used in the developer console user interface. 

####node_modules:
Contain the node modules installed as the part of the oodebe installation. See section Dependencies above.

####scripts:
Contains the scripts that are created from the developer console. The scripts folder contains sub-folders for each different type of script. 
Each script file is a JSON encoded file that contains the script’s properties as well as the script code.


## Wiki
* [Installation](https://github.com/oodebe/oodebe/wiki/Installation)
* [Functions](https://github.com/oodebe/oodebe/wiki/Functions)

   

   
   
   
   
   
   
   
   

## Running Sample Scripts

After installation, if you start the oodebe web console, you will see various sample scripts for Lily, Neo4j, Node.js 
and Solr.  These scripts assume that you have all these servers correctly installed and configured in conf.js

