// Test Object Model
module.exports = {
	'type':'test',
	'operations': {
		'series': {
			'priority': 'high',
			'type': 'SeriesController',
			'processors':[
				{'type': 'TestProcessor'},
				{'type': 'TestProcessor'}
			],
			'log': {
				"success" : "success.log"
				,"error" : "error.log"
				,"result" : "result.log"
			}
		},
		
		'parallel': {
			'priority': 'high',
			'type': 'ParallelController',
			'processors':[
				{'type': 'TestProcessor'},
				{'type': 'TestProcessor'}
			],
			'log': {
				"success" : "success.log"
				,"error" : "error.log"
				,"result" : "result.log"
			}
		},
		
		'batch': {
			'priority': 'low',
			'type': 'BatchController',
			'concurrency': 2,
			'processors':[
				{'type': 'SourceProcessor', pageLength: 20},
				{'type': 'ObjectProcessor'}
			],
			'log': {
				"success" : "",
				"error" : "",
				"result" : ""
			}
		},
	},
	
};