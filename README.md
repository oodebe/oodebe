# OODEBE

polyglot persistence and indexing engine

### Polyglot Persistence

The first critical step in application design is the choice of the database. Conventionally, the choice was simple, for all the options were relational databases (RDBMS) and they provided a consistent interface (SQL) that was platform independent. 

However RDBMS technology is not capable of handling large volume or variety of data. The emergence of big data technologies has thrown up a plethora of options for non-relational database models that provide efficient storage, retrieval and manipulation of large volume of data and with different data models.

Databases can be categorized based on the data model and the compromise of CAP - ie Consistency, Availability and Partition Tolerance that they implement. 

####Data Models
There are several different data models that database engines now provide. The following are the most widely known models:
* Relational : Oracle, MS-SQL, Mysql, PostgreSQL, Greenplum, Teradata
* Key/Value : BerkleyDB, MemcachedDB, Redis, Voldermort
* Column-oriented : Hadoop/Big Insights, Hbase, Cassandra
* Document-oriented : MongoDB, CouchDB, Riak
* Graph-oriented : Neo4J, Blueprints
* Search : Solr, Elastic Search, GSA

####CAP ability
The CAP theorem proves that of the three attributes of Consistency, Availability and Partition Tolerance, any database can only provide two attributes. Each database therefore can only provide two of these attributes. 

For more information about how different engines work out the CAP compromise, see the following link:
http://blog.nahurst.com/visual-guide-to-nosql-systems

####Which database to choose?
Considering the above two attributes that various database engines provide, we often come across applications which require to handle more than one data model and with different CAP combinations.

Polyglot Persistence suggests that instead of attempting to compromise the capabilities of a single database engine, it is recommended to use more than one database engine to suit the nature of data that the application needs to handle.

####Challenges of Polyglot Persistence
However, when more than one database is used in an application, it introduces complexities in the application for the following:
* Synchronization
How will multiple databases be synchronized during CRUD operations?

* Performance
How will CRUD operations (individual and batch) be optimized for performance in spite of having multiple operations for each database engine?

* Scalability
How will the application be able to scale up in the number of operations it can handle when it has to deal with multiple databases?

* Extensibility
How will the architecture be extensible in case we need to change the database engine or add a new one?

####Answer: Oodebe provides the platform
Having handled these challenges in various applications, we have created Oodebe as a reusable platform for addressing these challenges by implementing the following:

* Modular, event driven, distributed architecture for modeling complex synchronization sequences
* Asynchronous I/O for ensuring large number of concurrent operations per CPU
* Extensible plugin based architecture that allows developers to add new functionality such as reusable synchronization controllers, or database handlers
* Kanban Queues for managing balanced processing of batch operations without affecting performance


##Installation

Install oodebe package which is the core oodebe engine

	npm install oodebe -g

##Starting the server

	npm start oodebe -g

Verify if the server is started by hitting the following url

	http://<host>:3000/status

##Stopping the server

From command line

	npm stop oodebe -g
	
Or, by hitting the shutdown API
	
	http://<host>:3000/_shutdown

#OODEBE Cluster Architecture

oodebe supports cluster architecture to distribute the work as per required by application model design. Following are some feature of this model


##Discovery

Every node within the cluster is aware about every other node. They maintains a hash of active nodes along with their address and port, and broadcasts a heartbeat packet to the make other nodes in the cluster aware that its alive.

A dead or non-responding node is automatically removed from the cluster if no heartbeat is received from it within a specified time.

Each node must be replica of each other, and can receive and serve the requests. Every node has a local master which initializes local workers to utilize CPU effectively by using all the cores allocated for it.

##Internal Load balancer

oodebe has built-in support for distributing the requests with its local workers as well as with other nodes within the same cluster. It shares the load in round robin fashion and tries to fill up all the local workers first. If no local workers have capacity to serve a particular request, the node delegates the request to one of the other nodes in the cluster. Hence, for that request, it acts as master keeps the clients connection alive until some node has replied to the request. In case no node in the cluster is able to serve the request, it responds back with the message “No free workers found”. In this case the user can retry the request after a while.

##Failover

Since the oodebe is architected in a way that no two nodes are dependent on each other, they can be operated separately. Primary benefit from this setup is that, in case of any break down of any particular node, there is no need of reconfiguring or starting any services of the oodebe to continue serving requests.
The external load balancer can simply switch the IP and start sending the request to another node in the cluster. The nodes remaining in the cluster can continue to serve the request and do the load balancing with the active nodes.

##Prioritizing Important Jobs

oodebe can be configured to server multiple types of jobs, for e.g. some jobs like batch import or batch export jobs can be considered as low priority jobs as compared to jobs that require immediate response and can not be rejected in any case. for e.g. user operations or search. This setting can be done in the config.js file. A sample configuration is shown below to illustrate use of each settings.

##Server Configurations

	{
		port: 3000,
		
		total_workers: 4,
		
		priorities: {
			'low': {
				percent: 50,
				per_worker: 1
			},
			
			'high': {
				percent: 50,
				per_worker: 0
			}
		}
	}


###total_workers

Total number of workers per node, to be set according to the number of CPU cores available for Oodebe. The master will fork given number of workers and allocate for each priority group specified.

###priorities

Can have different priority levels for different types of requests. Each priority level should specify percent and per_worker attribute. The API model should contain corresponding priority level in each API.

###percent

Percentage of total workers to be used to serve each priority group requests. for e.g. if total workers allocated are 4, and 50 percent of them are allowed to serve ‘low’ priority requests then 2 workers will be forked for it.

###per_worker

Number of concurrent request served by each of the workers, 0 (zero) means no limit, useful to serve high priority requests which can’t be rejected.

##API Model Configuration

The oodebe API models need to contain the corresponding priority level that determines priority of each individual API. These values must be defined in the server config file.

Here is a sample API Model configuration:

	{
	   'type':'test',
	   'operations': {
	  	 'series': {
	  		 'priority': 'high',
	  		 'type': 'SeriesController',
	  		 'processors':[
	  			 {'type': 'TestProcessor'},
	  			 {'type': 'TestProcessor'}
	  		 ]
	  	 },
	  	 
	  	 'parallel': {
	  		 'priority': 'high',
	  		 'type': 'ParallelController',
	  		 'processors':[
	  			 {'type': 'TestProcessor'},
	  			 {'type': 'TestProcessor'}
	  		 ]
	  	 },
	  	 
	  	 'batch': {
	  		 'priority': 'low',
	  		 'type': 'BatchController',
	  		 'concurrency': 2,
	  		 'processors':[
	  			 {'type': 'SourceProcessor', pageLength: 20},
	  			 {'type': 'ObjectProcessor'}
	  		 ]
	  	 },
	   },
	}


###operations
Operation contains the synchronization model for all the defined operations/process, which needs to be performed. It is used by oodebe base classes to initiate and start the controllers as defined in it.  

###priority
It is used to define the ‘Priority level’ of this operation as defined in server configuration. The operation will be executed by one of the assigned worker for that priority level. If left blank or value used is not defined in server configuration, oodebe will use default priority level (default would be the first priority level defined in the server-configuration) for this operation.   

###type
Type defines the class which needs to be invoked at that particular level by oodebe based on the synchronization required for that operation.

###processors
Contains the information of processor classes which is used internally by controller level classes to initiate processors based on the synchronization required for that operation.
