// Test Object Model
module.exports = {
	'type':'test',
	'operations': {
		'start': {
			'type':'SeriesController',
			'processors':[
				{'type':'TestProcessor', action: 'action1'}, // can have additional keys for passing parameters to the processor
				{'type':'TestProcessor', action: 'action2'}, // can have additional keys for passing parameters to the processor
			],
		},
	},
};