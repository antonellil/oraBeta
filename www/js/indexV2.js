function testProcess(data) {
    console.log(data);
}

var mapOptions;
var map;
var hereMarker;
var specialMarker;

var app = {
    testprocess: function(data) {
        console.log(data);
    },
    init: function() {
        //Initialize basic variables and conduct the initial search
        app.user = null;
        app.geocoder = new google.maps.Geocoder();
        app.searchLocation = 'current location';
        app.resultsPerPage = 25;
        app.offset = 0;

        app.search(app.searchLocation,0);

        //DOM Listeners - TODO: Move listeners to more appropriate location
        $('#currentLocationIcon').click(function(){
            $('#searchField').val('Current Location');
        });

        $('#searchButton').click(function(){
            app.searchLocation = $('#searchField').val().toLowerCase();
            app.offset = 0;
            app.search(app.searchLocation,app.offset);      
        });

        $('#resultsSliderWrap').on('resultsChange',function(event,val){
            app.updateSliderHandle(val);
        });

        $('#selectedResult').on("swipe click", function( event ) {
            $.mobile.changePage("#mapPage", {
                transition: "slide"
            });
        });

        $('#nextPageResults').click(function(){
            if(app.results.length>(app.resultsPerPage-1)) {
                app.offset+=app.resultsPerPage;
                app.search(app.searchLocation,app.offset)
            }
        });

        $('#prevPageResults').click(function(){
            if(app.offset>0) {
                app.offset-=app.resultsPerPage;
                app.search(app.searchLocation,app.offset);
            }
        });

        $('#results').on("vmousemove click",function(event) {
            alert(Math.floor((event.clientY-98)/12));
        });
    },
    //Conduct search given the contents of the search input
    search: function(location,offset) {
        app.resetSearch();
        $('#loadingOverlay').show();
        if(location=='current location') {
            //Temp for testing
            app.header = 'Here';
            var tomo = new Date();
            tomo.setDate(tomo.getDate() + 1);

            //Params for results query
            app.today = app.getDay(new Date());
            app.tomorrow = app.getDay(tomo);
            app.type = $('.specialType:checked').map(function(){return this.value;}).get();
            app.time = app.parseTime(app.getTime());
            app.when = $('#specialDay').val();

            $('#searchHeader h1').text(app.header+' '+app.when);
            $('#mapHeader h1').text('There '+app.when);

            //TODO when ready for device uncomment below and move above code
            navigator.geolocation.getCurrentPosition(function(position) {
                app.lng = position.coords.longitude;
                app.lat = position.coords.latitude;

                //TODO check for internet connection
                $.ajax({
                    url: "http://wherebearadmin.herokuapp.com/specials",
                    type: 'GET',
                    dataType: 'jsonp',
                    data: {lat:app.lat,lng:app.lng,today:app.today,type:app.type,time:app.time,when:app.when,tomorrow:app.tomorrow,
                        search:app.searchLocation,offset:offset,limit:app.resultsPerPage},
                    cache: true,
                    timeout: 5000,
                    success: function(json) {
                        console.log(json);
                        if(json.error) {
                            alert(json.errorMessage);
                            $('#loadingOverlay').hide();
                        } else {
                            app.results=json.data;
                            if(app.results.length>0) {
                                app.processResults();
                            } else {
                                alert("Bro results, try another search");
                                $('#loadingOverlay').hide();
                            }
                        }
                    },
                    error: function(xhr, status, error) {
                        console.log('error[' + status + '] jsonp');
                        $('#loadingOverlay').hide();
                    }
                });
            }, function(error) {
                alert('There was an error detecting your location, please try again!');
                $('#loadingOverlay').hide();
            });
        } else {
            app.resetSearch();

            //Make heroku API call with appropriate query params and filters and callback accordingly
        }

    },
    //Gets the WhereBear day of week given a date object
    getDay: function(date) {
        var weekday = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
        var day = date.getHours() < 5 ? date.getDay() - 1 : date.getDay();
        return weekday[day];
    },
    //Gets the current client time
    getTime: function() {
        var today = new Date();
        return today.getHours()+':'+today.getMinutes();
    },
    //Converts string military time to standard time
    toStandardTime: function(time) {
        var timeParts = time.split(":");
        var hour = parseInt(timeParts[0]) > 12 ? parseInt(timeParts[0]) % 12 : (parseInt(timeParts[0])==0 ? 12 : parseInt(timeParts[0]));
        var ap = timeParts[0] > 11 ? 'P' : 'A';
        return hour+':'+timeParts[1]+ap
    },
    //Resets the appropriate DOM elements and variables when search is initialized
    resetSearch: function() {
        var left = app.parseTime(app.getTime())/24.00 * 100.0;
        $('#nowLine').css('left',left+'%').hide();
        $('#resultsHeader').hide();
        $('#results').html("").hide();
        $('#resultsSliderWrap').hide();
    },
    finishSearch: function() {
        $('#resultsSlider').val(0).slider('refresh');
        $('#resultsHeader').fadeIn();
        $('#resultsSliderWrap').fadeIn();
        $('#results').fadeIn();
        $('#nowLine').fadeIn();
        $('#loadingOverlay').hide();
    },
    //Processes returned results for the DOM
    processResults: function() {
        //Injects each result into the DOM
        $.each(app.results,function (i,item) {
            $('#results').append('<div class="result" index="'+i+'" '+app.resultProperties(item)+'></div>');
        });

        //Sets the properties of the search elements
        app.currentResult = app.results[0];
        var sliderHeight = (app.results.length - 1)*12;
        $('a.ui-slider-handle-vertical').attr('resultIndex',0);
        $('.ui-slider-vertical').css('height',sliderHeight+'px');
        $('input[type=number]').attr('max',(app.results.length - 1));
        app.fillSelectedResult(app.results[0]);
        $('[index="0"]').addClass('highlight');

        //Show results
        app.finishSearch();
    },
    updateSliderHandle: function(val) {
        var current = $('a.ui-slider-handle-vertical').attr('resultIndex');
        
        if(current != val) {
            $('a.ui-slider-handle-vertical').attr('resultIndex',val);
            $('[index="'+current+'"]').removeClass('highlight');
            app.currentResult = app.results[val];
            app.fillSelectedResult(app.results[val]);
            $('[index="'+val+'"]').addClass('highlight');
        }
    },
    fillSelectedResult: function(result) {
        var value = result.valuetype == 'price' ? '$'+result.value.toFixed(2) : (result.value*100).toFixed(0)+'%';
        result.type == 'drink' ? $('.selectedResult .desc').removeClass().addClass('desc drink') : 
            (result.type == 'food' ? $('.selectedResult .desc').removeClass().addClass('desc food') : 
                $('.selectedResult .desc').removeClass().addClass('desc event'));
        $('.selectedResult .value').html(value);
        $('.selectedResult .dist').html(result.distance.toFixed(2)+'mi');
        $('.selectedResult .desc').html(unescape(result.description));
        $('.selectedResult .venue').html(unescape(result.venue));
        $('.selectedResult .time').html(app.toStandardTime(unescape(result.starttime))+' - '+app.toStandardTime(unescape(result.endtime)));
        $('.selectedResult .address').html(unescape(result.address)+', '+unescape(result.city));
    },
    resultProperties: function(result) {
        var width= ((result.endvalue-result.startvalue) / 24.00)*100.0;
        var left = result.startvalue / 24.00 *100.0;
        return 'style="width:'+width+'%;left:'+left+'%;"';
    },
    parseTime: function(time) {
        var timeParts = time.split(":");
        var convertedMinutes = parseFloat(timeParts[1])/60.0;
        return parseFloat(String((parseInt(timeParts[0])+19) % 24)+String(convertedMinutes).replace("0",""));
    }
}

/* App initialization variables and functions ----------------------------------------------------------- */
var deviceReadyDeferred = $.Deferred();
var jqmReadyDeferred = $.Deferred();
var googleReadyDeferred = $.Deferred();

document.addEventListener("deviceReady", deviceReady, false);
google.maps.event.addDomListener(window, 'load', googleReady);

function deviceReady() {
  deviceReadyDeferred.resolve();
}

function googleReady() {
  googleReadyDeferred.resolve();
}

$(document).bind("mobileinit", function () {
    $.support.cors = true;
    $.mobile.allowCrossDomainPages = true;
    $.mobile.defaultHomeScroll = 0;
    $.mobile.defaultPageTransition = 'none';
    jqmReadyDeferred.resolve();
}).on("pageshow", "#mapPage", function(){
    $('#mapHeader h1').text(unescape(app.currentResult.venue));

    //Initialize map objects if necessary
    mapOptions = mapOptions || {
        zoom: 8,
        center: new google.maps.LatLng(app.lat, app.lng),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: true,
        zoomControl: false
    };
    map = map || new google.maps.Map(document.getElementById('mapCanvas'),mapOptions);

    //Remove old markers
    if(hereMarker){
        hereMarker.setMap(null);
    }

    if(specialMarker){
        specialMarker.setMap(null);
    }

    //Set up the lat lng vars and icon
    var hereLatLng = new google.maps.LatLng(app.lat, app.lng);
    var thereLatLng = new google.maps.LatLng(app.currentResult.lat, app.currentResult.lng);
    var icon = {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        strokeColor: '#0D4D42',
        fillColor: '#178D78',
        fillOpacity: 1,
        strokeWeight: 1,
        scale: 5
    };

    //Set map bounds and adjust
    var bounds = new google.maps.LatLngBounds();
    bounds.extend(hereLatLng);
    bounds.extend(thereLatLng);
    map.fitBounds(bounds);

    //Drop the markers
    hereMarker = new google.maps.Marker({
        position: hereLatLng,
        map: map,
        title: "Here",
        draggable: false,
        icon: icon,
        animation: google.maps.Animation.DROP
    });
    specialMarker = new google.maps.Marker({
        position: thereLatLng,
        map: map,
        icon: icon,
        title: unescape(app.currentResult.description),
        draggable: false,
        animation: google.maps.Animation.DROP
    });

    //TODO move this to a function call
    $('#yelpWrap .image').html('');
    $('#yelpWrap .rating').html('');
    $('#yelpWrap .reviews').html('');
    $('#yelpWrap .yelplogo').hide();
    $('#yelpWrap').addClass('loading');

    $.ajax({
        url: "http://wherebearadmin.herokuapp.com/venueyelp",
        type: 'GET',
        dataType: 'jsonp',
        data: {lat:app.currentResult.lat,lng:app.currentResult.lng,venue:app.currentResult.venue},
        cache: true,
        timeout: 5000,
        success: function(json) {
            console.log(json);
            if(json.error) {
                $('#yelpWrap').removeClass('loading');
                alert("Error getting Yelp info");
            } else {
                $('#yelpWrap').removeClass('loading');
                $('#yelpWrap .rating').html('<img src="'+json.data.businesses[0].rating_img_url_small+'" />');
                $('#yelpWrap .reviews').html(json.data.businesses[0].review_count+' reviews');
                $('#yelpWrap .image').html('<img src="'+json.data.businesses[0].image_url+'" />');
                $('#yelpWrap .yelplogo').show();
            }
        },
        error: function(xhr, status, error) {
            $('#yelpWrap').removeClass('loading');
            alert("Error getting Yelp info");
        }
    });
});

$.when(deviceReadyDeferred, jqmReadyDeferred, googleReadyDeferred).then(app.init());

