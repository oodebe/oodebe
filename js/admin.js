$(document).ready(function() {
	$.ajax({url:"html/header.html",cache:false,dataType:'html',success:function(data) {
		$('body').append(data);
		if (location.search.match(/page=(.*$)/i)) {
			var loc=RegExp.$1;
			if (loc && loc!='') {
				$('iframe').attr('src',loc);
			}
		}
	}});
});