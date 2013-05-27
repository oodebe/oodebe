// Batch Model
module.exports = {
	'type':'batch',
	'operations': {
		'start': {
			'type':'BatchController',
			'concurrency':2,
			'processors':[
				{'type':'SourceProcessor','pageLength':10,'maxCount':20},
				{'type':'NeoObject_Controller',
					'processors':[
						{'type':'NeoProcessor'}, // can have additional keys for passing parameters to the processor
						{'type':'LoopController',
						'buffer':1,
						'operationName':'addData',
						'processors':[
								{'type':'ParallelController','processors':[{'type':'MongoProcessor'},{'type':'SolrProcessor'},]},
						]},							
						{'type':'LoopController',
						'buffer':1,
						'operationName':'updateData',
						'processors':[
								{'type':'ParallelController','processors':[{'type':'MongoProcessor'},{'type':'SolrProcessor'},]},
						]},
					],
				},
			],
		},
	},
};
