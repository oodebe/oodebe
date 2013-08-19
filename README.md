# oodebe

object-oriented data exploration and binding engine

# What is oodebe?

object-oriented
Handle operations on objects in the conventional object-oriented paradigm

data exploration
Explore objects using search and retrieval in response to a query or a set of constraints

data binding
Bind objects for storage or retrieval to one or more data sources or database engines so as to maintain synchronization between them

# Why oodebe?

Polyglot Persistence
To build applications that handle complex objects which represent different types of information, we often need to use a combination of multiple persistence or indexing engines such as:
Relational : Oracle, MS-SQL, Mysql, PostgreSQL, Greenplum, Teradata
Key/Value : BerkleyDB, MemcachedDB, Redis, Voldermort
Column-oriented : Hadoop/Big Insights, Hbase, Cassandra
Document-oriented : MongoDB, CouchDB, Riak
Graph-oriented : Neo4J, Blueprints
Search : Solr, Elastic Search, GSA

Here is what others are saying about polyglot persistence:

“Polyglot Persistence, like polyglot programming, is all about choosing the right persistence option for the task at hand” - Scott Leberknight

“A complex enterprise application uses different kinds of data, and already usually integrates information from different sources. Increasingly we'll see such applications manage their own data using different technologies depending on how the data is used” - Martin Fowler

“Different databases are designed to solve different problems. Using a single database engine for all of the requirements usually leads to non-performant solutions” - Pramodkumar J Sadalage, Martin Fowler


# How Does it work ? / Architecture


# Installation

Install oodebe package which is the core DPE engine

npm install oodebe -g

# Starting the server

npm start oodebe -g

Verify if the server is started by hitting the following url

http://<host>:3000/status

# Stopping the server

http://<server_name>:3000/_shutdown
