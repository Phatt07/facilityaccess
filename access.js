var app = angular.module('facilityAccess', ['ngSanitize','spNgModule','ui.router', 'angular.filter','ui.bootstrap', 'ngIdle', 'ngCapsLock']);

app.constant("IS_APP_WEB", true);

var weburl = _spPageContextInfo.webServerRelativeUrl.replace(/\/$/g,'');
var contexturl = weburl + "/_api/ContextInfo";
var sender = _spPageContextInfo.userLoginName.split("@")[0];
var protocol = window.location.protocol;
var endpoint = '//clydewap.clydeinc.com/webservices/json/ClydeWebServices/';

function getParameterByName(name, url) {
    if (!url) {
      url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}
//config
app.config(['$stateProvider', '$urlRouterProvider', '$locationProvider', '$httpProvider', function($stateProvider, $urlRouterProvider, $locationProvider, $httpProvider){
	$httpProvider.defaults.withCredentials = true;
	$stateProvider
		.state('list', {
				url: '/list',
				templateUrl: "/apps/SiteAssets/html/apps/facilityaccess/views/view-list.html",
				controller: 'facilityController'
		})	
		.state('waitingforapproval', {
				url: '/waitingforapproval',
				templateUrl: "/apps/SiteAssets/html/apps/facilityaccess/views/view-waitingforapproval.html",
				controller: 'facilityController'
		})

		.state('create', {
			url: '/create',
			templateUrl: "/apps/SiteAssets/html/apps/facilityaccess/views/view-create.html",
			controller: 'facilityController'
		})
		.state("otherwise", { url : '/create'});
}]);

//run
app.run(function ($rootScope, $location) {	
  // register listener to watch route changes
	$rootScope.$on( "$locationChangeStart", function(event, next, current) {
        // not going to #login, we should redirect now
		if(getParameterByName("route", location.href) === "list" || getParameterByName("route", location.href) === "waitingforapproval" || getParameterByName("route", location.href) === "testwaiting"){
        	$location.path( "/" + getParameterByName("route", location.href) );
		}
		else
			$location.path("/create");    
    });
});

//Services
app.service("userProfileService",["$http", function($http){
	var userProfileService = {
		getDownline: function() {
			var jsonObject = JSON.stringify({SupervisorId: sender});
			var promise = $http(
			{
				method: 'POST',
				url: protocol + endpoint + 'GetAllDownline',
				headers: {'Content-Type':undefined},
				data: jsonObject
			})
			.then(function(json) {
				//get employee profile
				return json.data;
			});
			
			return promise;
		},
		getIp: function () {
			var promise = $http(
			{
				method: 'POST',
				url: protocol + endpoint + 'GetIP',
				headers: {'Content-Type':undefined},
				dataType: "json"
			})
			//This is called a promise
			.then(function (json) {
				return json.data;
			})
			.catch(function (data) {
   			     // Handle error here
  			});
			
			return promise;
		},
		
		generateToken: function(code, salt, account, ip) {			
			// Set the key to a hash of the user's password + salt + username.
			var hashedPassword;

			var hashedPassword = CryptoJS.enc.Base64.stringify(CryptoJS.PBKDF2(code, salt,{hasher:CryptoJS.algo.SHA256, iterations: 1500, keySize: 8}));
			var key = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256([hashedPassword, salt, account].join(':'), salt));

			// Get the (C# compatible) ticks to use as a timestamp. http://stackoverflow.com/a/7968483/2596404
			var date = new Date();
			var ticks = ((date.getTime() * 10000) + 621355968000000000);
			// Construct the hash body by concatenating the username, ip, and userAgent.	
			var ua = navigator.userAgent.split(' ');
			var message = [account, ip, ua[2]+ua[1], ticks].join(':');

			// Hash the body, using the key.
			var hash = CryptoJS.HmacSHA256(message, key);
			// Base64-encode the hash to get the resulting token.
			var token = CryptoJS.enc.Base64.stringify(hash);
			// Include the username and timestamp on the end of the token, so the server can validate.
			var tokenId = [account, ticks].join(':');

			// Base64-encode the final resulting token.
			var tokenStr = CryptoJS.enc.Utf8.parse([token, tokenId].join(':'));
	
			return CryptoJS.enc.Base64.stringify(tokenStr);
		},
		
		getToken: function(userId, ip) {
			key = userProfileService.generateToken(_spPageContextInfo.userLoginName, _spPageContextInfo.systemUserKey,userId,ip);
			var jsonObject = JSON.stringify({Email: _spPageContextInfo.userLoginName, Key:key});
			var promise = $http(
			{
				method: 'POST',
				url: protocol + endpoint + 'GetToken',
				headers: {'Content-Type':undefined},
				data: jsonObject
			})
			//This is called a promise
			.then(function (json) {

				return json;
			})
			.catch(function (data) {
   			     // Handle error here
				console.log("Error:");
				console.log(data);
  			});
			
			return promise;
		}		
	};
	return userProfileService;
}]);

app.service("activeDirectoryService",["$http", function($http){
	var activeDirectoryService = {
		getCompanies: function() {
			var promise = $http(
			{
				method: 'POST',
				url: protocol + endpoint + 'GetAllCompanies',
				dataType: "json"
			})
			.then(function(json) {
				//get all companies data
				return json.data;
				
			});
			
			return promise;
		},
		getFacilityLocations: function(company) {
			var jsonObject = JSON.stringify({Company:company});
			var promise = $http(
			{
				method: 'POST',
				url: protocol + endpoint + 'GetFacilityLocations',
				headers: {'Content-Type':undefined},
				data: jsonObject
			})
			.then(function(json) {
				//get all companies data
				return json.data;
			});
			
			return promise;
		}
	};
	return activeDirectoryService;
}]);

//controllers
app.controller('facilityController', ["$scope", "$location", "$state", "$http", "$uibModal", "spBaseService", "activeDirectoryService", "userProfileService", function($scope, $location, $state, $http, $uibModal, spBaseService, activeDirectoryService,userProfileService,vistaService) {	
	$scope.Account = sender;
	$scope.noLocationsKey = false;
	$scope.noLocationsAlarm = false;
	$scope.isNewHire = true;
	$scope.isUpdating = false;
	$scope.form = {};
	$scope.accessInfo = [];
	$scope.selected = {};
	$scope.isSelected = false;
	$scope.rows = [];
	$scope.noData = true;

	//Filter out company list (every company number that is less than 20)
	$scope.lessThan = function(company){
		return company.CompanyNumber < 20;
	}

	//validation function (check for null,empty and undefined)
	$scope.isValid = function(value) {
		return !value
	}
	//clears the form for another entry
	$scope.clearForm = function(){
		console.log($scope.keyLocations)
		$scope.keyLocations = [];
		angular.forEach($scope.keyLocations, function(name){
			name.checked = false;
		});
		console.log($scope.keyLocations)
		$scope.alarmLocations = [];
		angular.forEach($scope.alarmLocations, function(name){
			name.checked = false;
		});
		$scope.form = {};
		$scope.form.today = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear() + " " + hours + ":" + addZero(date.getMinutes()) + " " + mid;
	}

	//empty replacement info on click.
	$scope.clearReplacement = function(){
		if($scope.form.replacement){
			$scope.form.replacement = "";
		}	
	}

	//datepickers
	$('#starttimepicker').datetimepicker({
		ignoreReadonly: false
	});
	$('#starttimepicker1').datetimepicker({
		ignoreReadonly: true  
	});

	//add zero to minutes
	function addZero(i) {
    	if (i < 10) {
        	i = "0" + i;
    	}
    	return i;
	}

	//determine date time for now
	var date = new Date();
	var hours = date.getHours();
    var hours = (hours+24)%24; 
    var mid='AM';
    if(hours==0){ //At 00 hours we need to show 12 am
    	hours=12;
    }
    else if(hours>12)
    {
    	hours=hours%12;
    	mid='PM';
    }
	//This will get the start date formated mm/dd/yyyy hh:mm AM/PM
	$scope.form.today = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear() + " " + hours + ":" + addZero(date.getMinutes()) + " " + mid;
	$("#starttimepicker1").on("dp.change", function() {
		$scope.form.effective = $("#datetimepicker1").val();
	});
	
	//companies
	$scope.companies = [];
	$scope.refreshCompanies = function () {
		activeDirectoryService.getCompanies().then(function(data){
			$scope.companies = data;
		});
	}
	
	
	//employees
	$scope.employees = [];
	$scope.refreshEmployees = function () {
		userProfileService.getDownline().then(function(data){
			angular.forEach(data, function(value, key){
			$scope.employees.push(value.UserProfile[0]);
			});
			// console.log($scope.employees)
		});
	}
	
	//selected employee
	$scope.selectEmployee = function(){
		var employee = $scope.form.employee;
		if($scope.isValid(employee)){
			$scope.form.jobtitle = '';
			$scope.form.userid = '';
		}
	}
	$scope.getToken = function (){
				userProfileService.getIp().then(function(address){
					userProfileService.getToken(_spPageContextInfo.userId, address.Ip).then(function(){
						$scope.refreshCompanies();
						$scope.refreshEmployees();
					});
				});
			};
			$scope.getToken();

	//locations
	$scope.keyLocations = [];
	$scope.refreshKeyLocations = function () {
		activeDirectoryService.getFacilityLocations($scope.form.company.CompanyNumber).then(function(data){
			// console.log($scope);
			$scope.keyLocations = data;
		});
	}
	$scope.alarmLocations = [];
	$scope.refreshAlarmLocations = function () {
		activeDirectoryService.getFacilityLocations($scope.form.company.CompanyNumber).then(function(data){
			$scope.alarmLocations  = data;
		});
	}
	$scope.refreshLocations = function () {
		if(!$scope.isValid($scope.form.company)){
			$scope.refreshAlarmLocations();
			$scope.refreshKeyLocations();
			$scope.form.alarmLocations = "";
			$scope.form.keyLocations = "";
		}
	}

	//masterKey
	$scope.checkKeyLocations = function(){
		if(!$scope.isValid($scope.keyLocations[0])){
			$("#keyBtn").addClass("open");			
		}
		var i = 0;
		$scope.noLocationsKey = true;
		$scope.form.keyLocations = '';
		$("input[name=keyLocation]").each( function () {
			//make sure at least one item is selected
			var checked = $(this)[0].checked;
			if(checked){
				$scope.noLocationsKey = !checked;
				if(i===0){
					$scope.form.keyLocations += ($scope.keyLocations[i].Name);
				}
				else{
					$scope.form.keyLocations += (", " + $scope.keyLocations[i].Name);
				}
				
			}
			$scope.keyLocations[i].checked = checked;
			i++;
		});
	}
	$scope.checkKeyLocations();

	//masterAlarm
	$scope.checkAlarmLocations = function(){
		if(!$scope.isValid($scope.alarmLocations[0])){
			$("#alarmBtn").addClass("open");
		}
		var i = 0;
		$scope.noLocationsAlarm = true;
		$scope.form.alarmLocations = '';
		$("input[name=alarmLocation]").each( function () {
			//make sure at least one item is selected
			var checked = $(this)[0].checked;
			if(checked){
				$scope.noLocationsAlarm = !checked;
				if(i===0){
					$scope.form.alarmLocations += ($scope.alarmLocations[i].Name);
				}
				else{
					$scope.form.alarmLocations += (", " + $scope.alarmLocations[i].Name);
				}
				
			}
			$scope.alarmLocations[i].checked = checked;
			i++;
		});
	}
	$scope.checkAlarmLocations();
	
	$scope.submitRequest = function(){
		var clydePostionInfo = {};
		var facilitiesManagerQuery = "/_api/web/lists/GetByTitle('ClydeHierarchy')/Items?$filter=Title eq 'Facilities Manager'";
		var pushAccessInfoQuery = "/_api/web/lists/getbytitle('FacilityAccessList')/items";
		spBaseService.getRequest(facilitiesManagerQuery).then(function(data){
			clydePostionInfo = data.d.results[0];
			var pushData = {
			__metadata: { 'type': 'SP.Data.FacilityAccessListListItem' },
			Title: $scope.form.employee.FullName,
			Company_x0020_Number: $scope.form.company.CompanyNumber,
			jobtitle: $scope.form.employee.JobTitle,
			Manager: $scope.form.employee.SupervisorFullName,
			User_x0020_ID: $scope.form.employee.UserName,
			today: $scope.form.today,
			effective: $scope.form.effective,
			nh2s: $scope.form.position,
			abtz: $scope.form.positioninfo,
			replacement: $scope.form.replacement,
			keyLocations: $scope.form.keyLocations,
			o1k7: $scope.form.alarmLocations,
			pyoc: $scope.form.notes,
			WaitingForApprovalFromId: clydePostionInfo.ContactPersonId,
			Status:"initiated"

			}
			spBaseService.postRequest(pushData, pushAccessInfoQuery).then(function(data){
				alert("You have successfully submitted a facilities access request.");
			});

			location.reload();
		});
	}
	
	//this is to Edit the modal
	$scope.EditModal = function(info, status){
		var modalInstance = $uibModal.open({
			templateUrl: '/apps/SiteAssets/html/apps/facilityaccess/views/view-modify.html',
			controller: 'EditModalController',
			keyboard: false,
			backdrop: 'static',
			// scope: $scope,
			resolve: {
				editInfo: function () {
					return info;
				},
				statusInfo: function () {
					return $scope.status;
				}
			}
		});
		modalInstance.result.then(function (form) {
			$scope.getData();
			
			
		}, function () {
			//modal dismissed
		});
	}

	$scope.getData = function(){
		var userId = _spPageContextInfo.userId;
		var getAccessInfoQuery = "/_api/web/lists/getbytitle('FacilityAccessList')/items?$filter=";
		var filter = getParameterByName("FilterType", location.href) + " eq '" + getParameterByName("Value", location.href) + "'";
		if($state.current.name === "waitingforapproval"){
			filter = "WaitingForApprovalFrom eq "+ userId;
		}
		// if($state.current.name === "testwaiting"){
		// 	filter = "WaitingForApprovalFrom eq "+ userId;
		// }
		spBaseService.getRequest(getAccessInfoQuery + filter).then(function(data){
			if(data.d.results.length !== 0){
				for(var i = 0; i < data.d.results.length; i++){
					$scope.accessInfo[i] = data.d.results[i];
					$scope.accessInfo[i].effective = $scope.accessInfo[i].effective.split('T')[0];
					$scope.accessInfo[i].today = $scope.accessInfo[i].today.split('T')[0];
				}
				if($scope.accessInfo[0].WaitingForApprovalFromId === userId){
					var numberAcrossScreen = 2;
					for (var i=0, j=$scope.accessInfo.length; i < j; i+=numberAcrossScreen) {
						var temp = [];
						for(var v=i; v < i+numberAcrossScreen; v++ ){
							if($scope.accessInfo[v] && $scope.accessInfo[v].WaitingForApprovalFromId === userId){
								temp.push($scope.accessInfo[v]);
								if($scope.accessInfo[v].Status != "rejected")
									$scope.noData = false;					
							}
						}
						$scope.rows.push(temp);
					}
				}
				else{
					$scope.rows = [];
					$scope.accessInfo = [];

				}
			}
		});
	 }

	$scope.submitForApproval = function(){
		var siteurl = _spPageContextInfo.webAbsoluteUrl;
		var clydePostionInfo = {};
		
		angular.forEach($scope.selected, function(val, key) {
			if(key && val === true) {
				if($scope.accessInfo[0].Status === "initiated"){
					var updateAccessInfoQuery = "/_api/web/lists/getbytitle('FacilityAccessList')/items(" + key + ")"
					var getVPQuery = "/_api/web/lists/GetByTitle('ClydeHierarchy')/Items?$filter=Title eq 'VP'";
					spBaseService.getRequest(getVPQuery).then(function(data){
						clydePostionInfo = data.d.results[0];
						
						var updateItem = {
							__metadata: {
								type: "SP.Data.FacilityAccessListListItem"
							},
							WaitingForApprovalFromId: clydePostionInfo.ContactPersonId,
							Status: "status1"
						}
						spBaseService.updateRequest(updateItem, updateAccessInfoQuery).then(function(data){
							alert("Your approval has been submitted");
							window.location = "https://clydelink.sharepoint.com/apps/Pages/Home.aspx";
						});
					});
				}
				else if($scope.accessInfo[0].Status === "status1"){
					var getVPQuery = "/_api/web/lists/GetByTitle('ClydeHierarchy')/Items?$filter=Title eq 'alarmcompany'";
					var updateAccessInfoQuery = "/_api/web/lists/getbytitle('FacilityAccessList')/items(" + $scope.accessInfo[0].Id + ")"
					// console.log(clydePostionInfo)
					spBaseService.getRequest(getVPQuery).then(function(data){
						clydePostionInfo = data.d.results[0];
						
						var updateItem = {
							__metadata: {
								type: "SP.Data.FacilityAccessListListItem"
							},
							WaitingForApprovalFromId: clydePostionInfo.ContactPersonId,
							Status: "status2"
						}
						spBaseService.updateRequest(updateItem, updateAccessInfoQuery).then(function(data){
							alert("Your approval has been submitted");
							window.location = "https://clydelink.sharepoint.com/apps/Pages/Home.aspx";
						});
					});
				}
			}
		});
	}

	$scope.loadScroll = function(){
		$(".spacious-container").floatingScroll("update");	
	}

	$scope.check = function(checkBoxName){
		$("#"+checkBoxName+"").not(this).prop('checked', false);
	}

	$scope.getSelectedState = function() {
		$scope.isSelected = false;
		angular.forEach($scope.selected, function(key, val) {
			if(key) {
				$scope.isSelected = true;
			}
		});
	}

}]);

app.controller('EditModalController', ["$scope", "$http", "$uibModalInstance", "spBaseService", "editInfo", "statusInfo", function ($scope, $http, $uibModalInstance, spBaseService, editInfo, statusInfo) {
	$scope.form = {};
	$scope.editInfo = editInfo;
	// $scope.form.company = $scope.editInfo.Company_x0020_Number;
	// $scope.form.employee = $scope.editInfo.Title;
	// $scope.form.userID = $scope.editInfo.User_x0020_ID;
	// $scope.form.smrRepa = $scope.editInfo.SMRRepair;
	// $scope.form.notes = $scope.editInfo.Notes;
	// $scope.form.status = $scope.editInfo.Status;
	// $scope.status = statusInfo;
	// console.log(statusInfo)
	//datepickers
	$scope.getData = function(){
		$('#repairedtimepicker').datetimepicker({
			ignoreReadonly: true
		});
		$("#repairedtimepicker").on("dp.change", function() {
			$scope.form.repairedDate = $("#datetimepicker1").val();
		});
	}

	$scope.submitRequest = function() {
		var clydePostionInfo;
		if($scope.editInfo.Status === "initiated"){
			var updateAccessInfoQuery = "/_api/web/lists/getbytitle('FacilityAccessList')/items(" + $scope.editInfo.Id + ")"
			var getVPQuery = "/_api/web/lists/GetByTitle('ClydeHierarchy')/Items?$filter=Title eq 'VP'";
			spBaseService.getRequest(getVPQuery).then(function(data){
				clydePostionInfo = data.d.results[0];
				
				var updateItem = {
					__metadata: {
						type: "SP.Data.FacilityAccessListListItem"
					},
					WaitingForApprovalFromId: clydePostionInfo.ContactPersonId,
					Status: "status1"
				}
				spBaseService.updateRequest(updateItem, updateAccessInfoQuery).then(function(data){
					alert("Your approval has been submitted");
				});
					$uibModalInstance.close();
					location.reload();
			});
		}
		else if($scope.editInfo.Status === "status1"){
			var getVPQuery = "/_api/web/lists/GetByTitle('ClydeHierarchy')/Items?$filter=Title eq 'alarmcompany'";
			var updateAccessInfoQuery = "/_api/web/lists/getbytitle('FacilityAccessList')/items(" + $scope.editInfo.Id + ")"
			// console.log(clydePostionInfo)
			spBaseService.getRequest(getVPQuery).then(function(data){
				clydePostionInfo = data.d.results[0];
				
				var updateItem = {
					__metadata: {
						type: "SP.Data.FacilityAccessListListItem"
					},
					WaitingForApprovalFromId: clydePostionInfo.ContactPersonId,
					Status: "status2"
				}
				spBaseService.updateRequest(updateItem, updateAccessInfoQuery).then(function(data){
					alert("Your approval has been submitted");
				});
					$uibModalInstance.close();
					location.reload();
			});
		}
		else if($scope.editInfo.Status === "status2"){
			alert("Alarm company has confirmed.");
			// var getVPQuery = "/_api/web/lists/GetByTitle('ClydeHierarchy')/Items?$filter=Title eq 'alarmcompany'";
			// var updateAccessInfoQuery = "/_api/web/lists/getbytitle('FacilityAccessList')/items(" + $scope.editInfo.Id + ")"
			// // console.log(clydePostionInfo)
			// spBaseService.getRequest(getVPQuery).then(function(data){
			// 	clydePostionInfo = data.d.results[0];
				
			// 	var updateItem = {
			// 		__metadata: {
			// 			type: "SP.Data.FacilityAccessListListItem"
			// 		},
			// 		WaitingForApprovalFromId: clydePostionInfo.ContactPersonId,
			// 		Status: "status2"
			// 	}
			// 	spBaseService.updateRequest(updateItem, updateAccessInfoQuery).then(function(data){
			// 		alert("Your approval has been submitted");
			// 	});
			// 		$uibModalInstance.close();
			// 		location.reload();
			// });
		}
	}
	
	$scope.rejectRequest = function(){
		if($scope.form.rejectedNotes){
			var clydePostionInfo = {};
			var updateAccessInfoQuery = "/_api/web/lists/getbytitle('FacilityAccessList')/items(" + $scope.editInfo.Id + ")"
			var updateData = {
				__metadata: {
					type: "SP.Data.FacilityAccessListListItem"
				},
				pyoc: $scope.form.rejectedNotes,
				Status: "rejected"
			}
			spBaseService.updateRequest(updateData, updateAccessInfoQuery).then(function(data){
				alert("Request has been rejected.");
			});
			$uibModalInstance.close();
			location.reload();
		}
		else{
			alert("Please enter a reason for rejecting this request.");
		}
	}
	
	$scope.cancel = function () {
		if($scope.form.rejectedNotes){
			console.log($scope.form.rejectedNotes)
		}
		
		$uibModalInstance.close();
	};
}]);

window.addEventListener("load",function() {
    // Set a timeout...
    setTimeout(function(){
        // Hide the address bar!
        window.scrollTo(0, 1);
    }, 1000);
});