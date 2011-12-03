d#Oodebe

Oodebe is an asynchronous I/O based framework built on node.js for providing a consistent client (REST) API 
for synchronizing operations on one or more back-end server modules.


* Provides facilities to develop, test and deploy a REST API server
* Each API call can be constructed as a script
* Scripts can be executed as either native node.js scripts or one of the supported plugins
* Plugins allow scripts to access various REST servers such as Neo4j, SOLR, MongoDB, and Lily using their REST interface
* Additional plugins can be written in the form of simple JSON configuration files

##How to Install

* Download the zip from git repo and extract it
* Make sure you have installed the required back-end servers such as HBase, Solr, Lily, MongoDB etc.
* Edit configuration variables in conf.js so as to map the various server access details (see configuration variables below)
* Start oodebe server:   
   
   node index.js

* Start oodebe web console (assuming server is configured on port 8000:
       

   http://localhost:8000
   
## Requirements

* [Node 0.4.12] (http://nodejs.org/)
* [Async Module of Node] (https://github.com/caolan/async)
* [Rest Module of Node] (https://github.com/danwrong/restler)
* [Mongo Module of Node] (https://github.com/guileen/node-mongoskin)
* [Solr Module of Node] (https://github.com/gsf/node-solr)
* [Log Module of Node] (https://github.com/visionmedia/log.js)
* [UUID Module of Node] (https://github.com/broofa/node-uuid)
* [Cluster Module of Node] (https://github.com/LearnBoost/cluster)
* [Connect Module of Node] (https://github.com/senchalabs/connect)

## Functions 

### newuser
   Register a new user to oodebe. <br/>
   Input : user, callback <br/> 
   user : data of user in json which we want to store.
   
### authuser
   Check authentication of user . <br/>
   
   Input : request, user, callback <br/> 
   request : http request  <br/> 
   user : input parameter by GET or POST  
### logout 
   Destroy the session  <br/>
Input : query , request ,responsehttp <br/> 
query : input parameter by GET or POST <br/> 
request : http.server request parameter of callback <br/> 
responsehttp: http.server response parameter of callback

### fileprocess
   Send file to http if command is not defined. <br/>
   Input : request, responsehttp <br/> 
   Output :  return the file with http respnse .
   
### savefile   
 Save the script. <br/>
  Input : request, callback <br/> 
  request :input parameter by GET or POST 

### jsoncurl
   Send curl request ot REST Server  <br/>
   Input : burl, bdata, callback <br/> 
   burl : url of the curl <br/> 
   bdata : data to send with curl request    

### parseInputParamters  

 Parse the input parameter (string) by \n and first occurence of =  <br/> 
 Output : json <br/> 
 Input : dataparaminput (input parameter request.paraminput) <br/> 
 
### processquery
 
   Used to process each command requested by user . <br/>
   Input : query , request ,responsehttp <br/> 
   query : input parameter by GET or POST <br/> 
   request : http.server request parameter of callback <br/> 
   responsehttp: http.server response parameter of callback
   

   


### writeLog
   Write to the file.
   Input : file, string, flag, mode, skipDate <br/> 
   file : Name of the file <br/> 
   string : content of file <br/> 
   flag : e.g. 'a' for apped mode <br/> 
   mode : e.g. 755 <br/> 
   skipDate : Date which is to skip
 

## Configuration Variables

* Neo4j REST URL e.g. 'neo4jurl':"http://localhost:7474/db/data/ext/GremlinPlugin/graphdb/execute_script",
* Lily REST URL e.g. 'lilyurl':"http://localhost:12060/repository/record/",
* Solr REST URL e.g. 'solrurl':"http://localhost:8983/solr/select?",
* Mongodb Connection Url e.g. 'mongodbhost':"localhost:27017/test?auto_reconnect",
* Server port on which server run e.g. 'serverport':'8000',
* Host of solr  e.g.	'solrhost':'localhost',
* Port of Solr e.g. 'solrport':'8983'
* We can define our own config variable and use them in program. e.g. "newconfig": "value" can be use in program by
  config.newconfig it will give "value".

   

   
   
   
   
   
   
   
   

## Running Sample Scripts

After installation, if you start the oodebe web console, you will see various sample scripts for Lily, Neo4j, Node.js 
and Solr.  These scripts assume that you have all these servers correctly installed and configured in conf.js

