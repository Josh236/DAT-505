if ( ! THREE.WorkerLoader ) { THREE.WorkerLoader = {} }
if ( ! THREE.MeshTransfer || ! THREE.MeshTransfer.MeshReceiver || ! THREE.MeshTransfer.MeshTransmitter || ! THREE.MeshTransfer.Validator ) {

	console.error( '"THREE.MeshTransfer" is not available, but "THREE.OBJLoader2" requires it. Please include "MeshTransfer.js" in your HTML.' );

}

/**
 *
 * @param {THREE.DefaultLoadingManager} [manager]
 * @constructor
 */
THREE.WorkerLoader = function ( manager ) {
	console.info( 'Using THREE.WorkerLoader version: ' + THREE.WorkerLoader.WORKER_LOADER_VERSION );

	this.manager = THREE.MeshTransfer.Validator.verifyInput( manager, THREE.DefaultLoadingManager );
	this.loadingTask = new THREE.WorkerLoader.LoadingTask( 'WorkerLoader_LoadingTask' );
};
THREE.WorkerLoader.WORKER_LOADER_VERSION = '1.0.0-dev';


THREE.WorkerLoader.prototype = {

	constructor: THREE.WorkerLoader,

	/**
	 *
	 * @param {object} loader
	 * @param {object} [loaderConfig]
	 * @returns {THREE.WorkerLoader}
	 */
	setLoader: function ( loader, loaderConfig ) {
		this.loadingTask.setLoader( loader, loaderConfig );
		return this;
	},

	/**
	 *
	 * @param {THREE.WorkerLoader.LoadingTask} loadingTask
	 */
	setLoadingTask: function ( loadingTask ) {
		this.loadingTask = THREE.MeshTransfer.Validator.verifyInput( loadingTask, this.loadingTask );
		return this;
	},

	/**
	 *
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	getLoadingTask: function () {
		return this.loadingTask;
	},

	/**
	 * Execute a fully configured {@link THREE.WorkerLoader.LoadingTask}.
	 *
	 * @param {THREE.WorkerLoader.LoadingTask} loadingTask
	 * @returns {THREE.WorkerLoader}
	 */
	executeLoadingTask: function ( loadingTask ) {
		this.setLoadingTask( loadingTask );
		this.loadingTask.execute();
		return this;
	},

	/**
	 * Configure the existing {@link THREE.WorkerLoader.LoadingTask} with the supplied parameters.
	 *
	 * @param {THREE.WorkerLoader.LoadingTaskConfig} loadingTaskConfig
	 * @param {THREE.WorkerLoader.WorkerSupport} [workerSupport]
	 * @returns {THREE.WorkerLoader}
	 */
	executeLoadingTaskConfig: function ( loadingTaskConfig, workerSupport ) {
		this.loadingTask.execute( loadingTaskConfig, workerSupport );
		return this;
	},

	/**
	 * Use this method to load a file from the given URL and parse it asynchronously.
	 *
	 * @param {string}  url A string containing the path/URL of the file to be loaded.
	 * @param {function} onLoad A function to be called after loading is successfully completed. The function receives loaded Object3D as an argument.
	 * @param {function} [onMesh] A function to be called after a new mesh raw data becomes available (e.g. alteration).
 	 * @param {function} [onReport] A function to be called to communicate status (e.g. loading progess).
	 * @param {function} [onReportError] A function to be called if an error occurs during loading. The function receives the error as an argument.
	 * @returns {THREE.WorkerLoader}
	 */
	loadAsync: function ( url, onLoad, onMesh, onReport, onReportError ) {
		this.loadingTask.addResourceDescriptor( new THREE.WorkerLoader.ResourceDescriptor( 'URL', 'url_loadAsync', url ) )
			.updateCallbacksPipeline( null, null, onLoad )
			.updateCallbacksParsing( onMesh, null )
			.updateCallbacksApp( onReport, onReportError )
			.execute();
		return this;
	},

	/**
	 * Parses content asynchronously from arraybuffer.
	 *
	 * @param {arraybuffer} content data as Uint8Array
	 * @param {function} onLoad Called after worker successfully completed loading
	 * @param {function} [onMesh] Called after worker successfully delivered a single mesh
	 * @param {Object} [parserConfiguration] Provide additional instructions to the parser
	 * @returns {THREE.WorkerLoader}
	 */
	parseAsync: function ( content, onLoad, onMesh, parserConfiguration ) {
		var resourceDescriptor = new THREE.WorkerLoader.ResourceDescriptor( 'Buffer', null, content );
		resourceDescriptor.setParserConfiguration( parserConfiguration );

		this.loadingTask.addResourceDescriptor( resourceDescriptor )
			.updateCallbacksPipeline( null, null, onLoad )
			.updateCallbacksParsing( onMesh, null )
			.execute();
		return this;
	}
};

/**
 *
 * @param {String} description
 * @constructor
 */
THREE.WorkerLoader.LoadingTask = function ( description ) {
	this.logging = {
		enabled: true,
		debug: false
	};
	this.description = description;

	this.workerSupport = null;
	this.dataReceiver = null;

	this.baseObject3d = new THREE.Group();
	this.instanceNo = 0;
	this.terminateWorkerOnLoad = true;
	this.forceWorkerDataCopy = false;
	this.enforceSync = false;

	this.sendMaterials = true;
	this.sendMaterialsJson = false;

	this.loader = {
		ref: null,
		config: {},
		buildWorkerCode: null
	};
	this.resourceDescriptors = [];
	this.resetResourceDescriptors();

	this.callbacks = {
		app: {
			onReport: null,
			onReportError: null
		},
		parse: {
			onMesh: null,
			onMaterials: null
		},
		pipeline: {
			onComplete: null,
			onCompleteFileLoading: null,
			onCompleteParsing: null
		}
	};
};


THREE.WorkerLoader.LoadingTask.prototype = {

	constructor: THREE.WorkerLoader.LoadingTask,

	/**
	 * Enable or disable logging in general (except warn and error), plus enable or disable debug logging.
	 *
	 * @param enabled
	 * @param debug
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
		if ( THREE.MeshTransfer.Validator.isValid( this.workerSupport ) ) this.workerSupport.setLogging( this.logging.enabled, this.logging.debug );
		return this;
	},

	/**
	 * The instance number.
	 *
	 * @param {number} instanceNo
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	setInstanceNo: function ( instanceNo ) {
		this.instanceNo = THREE.MeshTransfer.Validator.verifyInput( instanceNo, this.instanceNo );
		return this;
	},

	/**
	 * Defines where meshes shall be attached to.
	 *
	 * @param {THREE.Object3D} baseObject3d
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	setBaseObject3d: function ( baseObject3d ) {
		this.baseObject3d = THREE.MeshTransfer.Validator.verifyInput( baseObject3d, this.baseObject3d );
		return this;
	},

	/**
	 *
	 * @param {Boolean} terminateWorkerOnLoad
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	setTerminateWorkerOnLoad: function ( terminateWorkerOnLoad ) {
		this.terminateWorkerOnLoad = terminateWorkerOnLoad === true;
		if ( THREE.MeshTransfer.Validator.isValid( this.workerSupport ) ) this.workerSupport.setTerminateWorkerOnLoad( this.terminateWorkerOnLoad );
		return this;
	},

	/**
	 * Forces all ArrayBuffers to be transferred to worker to be copied.
	 *
	 * @param {boolean} forceWorkerDataCopy True or false.
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	setForceWorkerDataCopy: function ( forceWorkerDataCopy ) {
		this.forceWorkerDataCopy = forceWorkerDataCopy === true;
		if ( THREE.MeshTransfer.Validator.isValid( this.workerSupport ) ) this.workerSupport.setForceWorkerDataCopy( this.forceWorkerDataCopy );
		return this;
	},

	/**
	 *
	 * @param {Boolean} enforceSync
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	setEnforceSync: function ( enforceSync ) {
		this.enforceSync = enforceSync === true;
		return this;
	},

	/**
	 *
	 * @param {object} loader
	 * @param {object} [loaderConfig]
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	setLoader: function ( loader, loaderConfig ) {
		if ( ! THREE.MeshTransfer.Validator.isValid( loader ) ) this._throwError( 'Unable to continue. You have not specified a loader!' );
		this.loader.ref = loader;
		this.loader.config = THREE.MeshTransfer.Validator.verifyInput( loaderConfig, this.loader.config );
		return this;
	},

	/**
	 * Funtion that is invoked to build the worker code. This overrules anything the loader already supplies.
	 * @param buildWorkerCode
	 */
	setBuildWorkerCodeFunction: function ( buildWorkerCode ) {
		this.loader.buildWorkerCode = buildWorkerCode;
	},

	/**
	 *
	 * @param resourceDescriptor
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	addResourceDescriptor: function ( resourceDescriptor ) {
		this.resourceDescriptors.push( resourceDescriptor );
		return this;
	},

	/**
	 *
	 * @param resourceDescriptors
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	resetResourceDescriptors: function ( resourceDescriptors ) {
		this.resourceDescriptors = Array.isArray( resourceDescriptors ) ? resourceDescriptors : this.resourceDescriptors;
		return this;
	},

	/**
	 *
	 * @param {Function} onMesh
	 * @param {Function} onMaterials
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	updateCallbacksParsing: function ( onMesh, onMaterials ) {
		this.callbacks.parse.onMesh = THREE.MeshTransfer.Validator.verifyInput( onMesh, this.callbacks.parse.onMesh );
		this.callbacks.parse.onMaterials = THREE.MeshTransfer.Validator.verifyInput( onMaterials, this.callbacks.parse.onMaterials );
		return this;
	},

	/**
	 *
	 * @param {Function} onComplete
	 * @param {Function} onCompleteLoad
	 * @param {Function} onCompleteParse
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	updateCallbacksPipeline: function ( onComplete, onCompleteFileLoading, onCompleteParsing ) {
		this.callbacks.pipeline.onComplete = THREE.MeshTransfer.Validator.verifyInput( onComplete, this.callbacks.pipeline.onComplete );
		this.callbacks.pipeline.onCompleteFileLoading = THREE.MeshTransfer.Validator.verifyInput( onCompleteFileLoading, this.callbacks.pipeline.onCompleteFileLoading );
		this.callbacks.pipeline.onCompleteParsing = THREE.MeshTransfer.Validator.verifyInput( onCompleteParsing, this.callbacks.pipeline.onCompleteParsing );
		return this;
	},

	/**
	 *
	 * @param {Function} onReport
	 * @param {Function} [onReportError]
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	updateCallbacksApp: function ( onReport, onReportError ) {
		this.callbacks.app.onReport = THREE.MeshTransfer.Validator.verifyInput( onReport, this.callbacks.app.onReport );
		this.callbacks.app.onReportError = THREE.MeshTransfer.Validator.verifyInput( onReportError, this.callbacks.app.onReportError );
		return this;
	},

	_throwError: function ( errorMessage, event ) {
		if ( THREE.MeshTransfer.Validator.isValid( this.callbacks.app.onReportError ) )  {

			this.callbacks.app.onReportError( errorMessage, event );

		} else {

			throw errorMessage;

		}
	},

	/**
	 * @param {THREE.WorkerLoader.LoadingTaskConfig} [loadingTaskConfig]
	 * @param {THREE.WorkerLoader.WorkerSupport} [workerSupport]
	 *
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	execute: function ( loadingTaskConfig, workerSupport ) {
		var loadingTask = this;
		var scopedLoadFiles = function ( payload ) {
			loadingTask._executeLoadFiles( payload );
		};
		this._initExecute( scopedLoadFiles, loadingTaskConfig, workerSupport );

		return this;
	},

	_initExecute: function ( callbackLoadFiles, loadingTaskConfig, workerSupport ) {
		this._applyConfig( loadingTaskConfig );
		if ( THREE.MeshTransfer.Validator.isValid( workerSupport ) && workerSupport instanceof THREE.WorkerLoader.WorkerSupport ) {

			this.workerSupport = workerSupport;

		} else {

			this.workerSupport = new THREE.WorkerLoader.WorkerSupport();
			this.workerSupport.setLogging( this.logging.enabled, this.logging.debug );
			this.workerSupport.setTerminateWorkerOnLoad( this.terminateWorkerOnLoad );
			this.workerSupport.setForceWorkerDataCopy( this.forceWorkerDataCopy );

		}


		this.dataReceiver = new THREE.MeshTransfer.MeshReceiver();
		this.dataReceiver.setLogging( this.logging.enabled, this.logging.debug );

		var loadingTask = this;
		var callbackDataReceiverProgress = function ( type, text, numericalValue ) {
			var content = THREE.MeshTransfer.Validator.isValid( text ) ? text : '';
			var event = {
				detail: {
					type: type,
					modelName: loadingTask.description,
					instanceNo: loadingTask.instanceNo,
					text: content,
					numericalValue: numericalValue
				}
			};
			if ( THREE.MeshTransfer.Validator.isValid( loadingTask.callbacks.app.onReport ) ) loadingTask.callbacks.app.onReport( event );
			if ( loadingTask.logging.enabled && loadingTask.logging.debug ) console.debug( content );
		};

		this.dataReceiver._setCallbacks( callbackDataReceiverProgress, this.callbacks.parse.onMesh, this.callbacks.parse.onMaterials );
		this.dataReceiver.setBaseObject3d( this.baseObject3d );
		this.dataReceiver.createDefaultMaterials();


		// do we need to provide ResourceDescriptors to Worker?
		var resourceDescriptor;
		var provideRds = false;
		for ( var name in this.resourceDescriptors ) {

			resourceDescriptor = this.resourceDescriptors[ name ];
			if ( ( resourceDescriptor.async.load || resourceDescriptor.async.parse ) && ! this.enforceSync ) {

				provideRds = true;
				break;

			}

		}
		var rdForWorkerInit = null;
		if ( provideRds ) {

			rdForWorkerInit = [];
			for ( var name in this.resourceDescriptors ) {

				resourceDescriptor = this.resourceDescriptors[ name ];
				rdForWorkerInit.push( resourceDescriptor.createSendable() );

			}

			this.workerSupport.validate( this.loader.ref, this.loader.buildWorkerCode, provideRds );
			this.workerSupport.updateCallbacks( callbackLoadFiles );
			this.workerSupport.runAsyncInitWorker( rdForWorkerInit );

		} else {

			callbackLoadFiles();

		}
	},

	/**
	 *
	 * @param {THREE.WorkerLoader.LoadingTaskConfig} loadingTaskConfig
	 *
	 * @returns {THREE.WorkerLoader.LoadingTask}
	 */
	_applyConfig: function ( loadingTaskConfig ) {
		loadingTaskConfig = THREE.MeshTransfer.Validator.verifyInput( loadingTaskConfig, null );

		var ownConfig = {};
		if ( THREE.MeshTransfer.Validator.isValid( loadingTaskConfig ) && loadingTaskConfig instanceof THREE.WorkerLoader.LoadingTaskConfig ) {

			ownConfig = loadingTaskConfig.config;
			var classDef = loadingTaskConfig.loader.classDef;
			if ( THREE.MeshTransfer.Validator.isValid( classDef ) ) {

				var loader = Object.create( classDef.prototype );
				classDef.call( loader );
				this.setLoader( loader, loadingTaskConfig.loader.config );
			}
			this.setBuildWorkerCodeFunction( loadingTaskConfig.loader.buildWorkerCode );

		}
		if ( ! THREE.MeshTransfer.Validator.isValid( this.loader.ref ) ) this._throwError( 'Unable to continue. You have not specified a loader!' );

		if ( typeof this.loader.buildWorkerCode !== 'function' && typeof this.loader.ref.buildWorkerCode === 'function' ) {

			this.loader.buildWorkerCode = this.loader.ref.buildWorkerCode;

		}
		if ( typeof this.loader.buildWorkerCode !== 'function' ) console.warn( 'No buildWorkerCode function is available for: ' + this.loader.ref.modelName );

		THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl.prototype.applyProperties( this, ownConfig );
		if ( loadingTaskConfig !== null ) {

			this.resetResourceDescriptors( loadingTaskConfig.resourceDescriptors );
			this.updateCallbacksApp(
				loadingTaskConfig.callbacks.app.onReport,
				loadingTaskConfig.callbacks.app.onReportError
			).updateCallbacksParsing(
				loadingTaskConfig.callbacks.parse.onMesh,
				loadingTaskConfig.callbacks.parse.onMaterials
			).updateCallbacksPipeline(
				loadingTaskConfig.callbacks.pipeline.onComplete,
				loadingTaskConfig.callbacks.pipeline.onCompleteFileLoading,
				loadingTaskConfig.callbacks.pipeline.onCompleteParsing
			);
		}

		if ( ! THREE.MeshTransfer.Validator.isValid( this.loader.ref ) ) {

			if ( this.logging.enabled ) console.warn( "Provided loader is not valid" );

		} else {

			// this will ensure that any base configuration on LoadingTask and Loader are aligned
			THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl.prototype.applyProperties( this.loader.ref, ownConfig );
			THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl.prototype.applyProperties( this.loader.ref, this.loader.config );
			if ( typeof this.loader.ref.setGenericErrorHandler === 'function' ) this.loader.ref.setGenericErrorHandler( this.callbacks.app.onReportError );

		}

		return this;
	},

	_executeLoadFiles: function () {
		var loadingTask = this;

		var fileLoadingExecutor = new THREE.WorkerLoader.FileLoadingExecutor( loadingTask.instanceNo, loadingTask.description );
		fileLoadingExecutor
			.setCallbacks( loadingTask.callbacks.app.onReport, loadingTask._throwError );

		var loadAllResources = function ( index ) {
			if ( index === loadingTask.resourceDescriptors.length ) {

				loadingTask._executeParseAssets();
				return;

			}
			var resourceDescriptorCurrent = loadingTask.resourceDescriptors[ index ];

			var onCompleteFileLoading = function ( content, completedIndex ) {
				if ( THREE.MeshTransfer.Validator.isValid( content ) ) loadingTask.resourceDescriptors[ completedIndex ].content = content;
				completedIndex++;
				loadAllResources( completedIndex );
			};

			if ( THREE.MeshTransfer.Validator.isValid( resourceDescriptorCurrent ) && resourceDescriptorCurrent.resourceType === 'URL' ) {

				if ( resourceDescriptorCurrent.async.load ) {
					loadingTask.workerSupport.updateCallbacks( onCompleteFileLoading );
					loadingTask.workerSupport.runAsyncLoad(
						{
							// specific parser instructions need to be set here
							params: {
								index: index,
								instanceNo: loadingTask.instanceNo,
								description: loadingTask.description,
								path: loadingTask.loader.ref.path
							}
						}
					)

				} else {

					fileLoadingExecutor.loadFile( resourceDescriptorCurrent, index, onCompleteFileLoading );

				}

			} else {

				onCompleteFileLoading( null, index );

			}

		};
		loadAllResources( 0 );
	},

	_executeParseAssets: function () {
		var loadingTask = this;
		var executeParsingStep = function ( index ) {
			if ( index === loadingTask.resourceDescriptors.length ) {

				loadingTask._finalizeParsing();
				return;

			}
			var resourceDescriptorCurrent = loadingTask.resourceDescriptors[ index ];
			var result;
			var useAsync = resourceDescriptorCurrent.async.parse && ! loadingTask.enforceSync;
			if ( useAsync ) {

				var scopedOnLoad = function ( measureTime ) {
					measureTime = THREE.MeshTransfer.Validator.verifyInput( measureTime, true );
					if ( measureTime && loadingTask.logging.enabled ) console.timeEnd( 'WorkerLoader parse [' + loadingTask.instanceNo + '] : ' + resourceDescriptorCurrent.name );

					result = loadingTask.baseObject3d;
					resourceDescriptorCurrent.setParserResult( result );
					var callbackOnProcessResult = resourceDescriptorCurrent.getCallbackOnProcessResult();
					if ( THREE.MeshTransfer.Validator.isValid( callbackOnProcessResult ) ) callbackOnProcessResult( resourceDescriptorCurrent );
					if ( THREE.MeshTransfer.Validator.isValid( loadingTask.callbacks.pipeline.onCompleteParsing ) ) {

						loadingTask.callbacks.pipeline.onCompleteParsing( {
							detail: {
								extension: resourceDescriptorCurrent.extension,
								result: resourceDescriptorCurrent.result,
								modelName: resourceDescriptorCurrent.name,
								instanceNo: loadingTask.instanceNo
							}
						} );

					}
					index ++;
					executeParsingStep( index );
				};

				var scopedOnMesh = function ( content ) {
					loadingTask.dataReceiver.processPayload( content );
				};

				// fast-fail in case of illegal data
				if ( ! THREE.MeshTransfer.Validator.isValid( resourceDescriptorCurrent.content ) && ! resourceDescriptorCurrent.async.load ) {

					console.warn( 'Provided content is not a valid ArrayBuffer.' );
					scopedOnLoad( false );

				} else {

					loadingTask.workerSupport.updateCallbacks( scopedOnMesh, scopedOnLoad );
					loadingTask._parseAsync( resourceDescriptorCurrent, index );

				}

			} else {

				THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl.prototype.applyProperties( loadingTask.loader.ref, resourceDescriptorCurrent.parserConfiguration );
				if ( typeof loadingTask.loader.ref.getParseFunctionName === 'function' ) {

					var parseFunctionName = loadingTask.loader.ref.getParseFunctionName();
					result = loadingTask.loader.ref[ parseFunctionName ]( resourceDescriptorCurrent.content, resourceDescriptorCurrent.parserConfiguration );

				} else {

					result = loadingTask.loader.ref.parse( resourceDescriptorCurrent.content, resourceDescriptorCurrent.parserConfiguration );

				}
				if ( typeof loadingTask.loader.ref.setBaseObject3d === 'function' ) {

					loadingTask.loader.ref[ 'setBaseObject3d' ]( loadingTask.baseObject3d );

				}
				resourceDescriptorCurrent.setParserResult( result );
				var callbackOnProcessResult = resourceDescriptorCurrent.getCallbackOnProcessResult();
				if ( THREE.MeshTransfer.Validator.isValid( callbackOnProcessResult ) ) callbackOnProcessResult( resourceDescriptorCurrent );
				if ( THREE.MeshTransfer.Validator.isValid( loadingTask.callbacks.pipeline.onCompleteParsing ) ) {

					loadingTask.callbacks.pipeline.onCompleteParsing( {
						detail: {
							extension: resourceDescriptorCurrent.extension,
							result: result,
							modelName: resourceDescriptorCurrent.name,
							instanceNo: loadingTask.instanceNo
						}
					} );

				}
				index ++;
				executeParsingStep( index );

			}
		};
		executeParsingStep( 0 );
	},

	/**
	 *
	 * @param {THREE.WorkerLoader.LoadingTask} loadingTask
	 * @private
	 */
	_parseAsync: function ( resourceDescriptor, index ) {
		if ( ! THREE.MeshTransfer.Validator.isValid( this.loader.ref ) ) this._throwError( 'Unable to run "executeWithOverride" without proper "loader"!' );
		if ( this.logging.enabled ) console.time( 'WorkerLoader parse [' + this.instanceNo + '] : ' + resourceDescriptor.name );

		var ltModelName = this.loader.ref.modelName;
		if ( ltModelName !== undefined && ltModelName !== null && ltModelName.length > 0 ) resourceDescriptor.name = this.loader.ref.modelName;
		if ( THREE.MeshTransfer.Validator.isValid( this.loader.ref.dataReceiver ) && this.loader.ref.dataReceiver instanceof THREE.MeshTransfer.MeshReceiver ) {

			this.dataReceiver.setMaterials( this.loader.ref.dataReceiver.getMaterials() );

		}

		var materialsContainer = {
			materials: {},
			serializedMaterials: {}
		};
		if ( this.sendMaterials ) {

			var materials = this.dataReceiver.getMaterials();
			for ( var materialName in materials ) materialsContainer.materials[ materialName ] = materialName;
			if ( this.sendMaterialsJson ) materialsContainer.serializedMaterials = this.dataReceiver.getMaterialsJSON();

		}
		var params = ( THREE.MeshTransfer.Validator.isValid( resourceDescriptor.parserConfiguration ) ) ? resourceDescriptor.parserConfiguration : {};
		if ( resourceDescriptor.async.load ) params.index = index;
		this.workerSupport.runAsyncParse(
			{
				// specific parser instructions need to be set here
				params: params,
				materials: materialsContainer,
				data: {
					input: resourceDescriptor.content,
					options: resourceDescriptor.dataOptions
				}
			},
			resourceDescriptor.transferables
		)
	},

	_finalizeParsing: function () {
		var resourceDescriptorCurrent = this.resourceDescriptors[ this.resourceDescriptors.length - 1 ];
		if ( resourceDescriptorCurrent.async.parse ) {

			if ( THREE.MeshTransfer.Validator.isValid( this.callbacks.pipeline.onComplete ) ) {

				this.callbacks.pipeline.onComplete( {
					detail: {
						extension: resourceDescriptorCurrent.extension,
						result: resourceDescriptorCurrent.result,
						modelName: resourceDescriptorCurrent.name,
						instanceNo: this.instanceNo
					}
				} );
			}

		} else {

			if ( THREE.MeshTransfer.Validator.isValid( this.callbacks.pipeline.onComplete ) ) {

				this.callbacks.pipeline.onComplete( this.baseObject3d );

			}

		}
	}
};

THREE.WorkerLoader.FileLoadingExecutor = function ( instanceNo, description ) {
	this.callbacks = {
		report: null,
		onError: null
	};
	this.instanceNo = instanceNo;
	this.description = description;
	this.path = '';
};

THREE.WorkerLoader.FileLoadingExecutor.prototype = {

	constructor: THREE.WorkerLoader.FileLoadingExecutor,

	setPath: function ( path ) {
		this.path = THREE.MeshTransfer.Validator.verifyInput( path, this.path );
		return this;
	},

	setCallbacks: function ( callbackAppReport, callbackOnError  ) {
		this.callbacks.report = callbackAppReport;
		this.callbacks.onError = callbackOnError;
		return this;
	},

	setManager: function ( manager ) {
		this.manager = THREE.MeshTransfer.Validator.verifyInput( manager, THREE.DefaultLoadingManager );
		return this;
	},

	/**
	 */
	loadFile: function ( resourceDescriptorCurrent, index, onCompleteFileLoading ) {
		var numericalValueRef = 0;
		var numericalValue = 0;
		var scope = this;
		var scopedOnReportProgress = function ( event ) {
			if ( ! event.lengthComputable ) return;

			numericalValue = event.loaded / event.total;
			if ( numericalValue > numericalValueRef ) {

				numericalValueRef = numericalValue;
				var url = ( resourceDescriptorCurrent === null ) ? '' : resourceDescriptorCurrent.url;
				var output = 'Download of "' + url + '": ' + ( numericalValue * 100 ).toFixed( 2 ) + '%';
				if ( THREE.MeshTransfer.Validator.isValid( scope.callbacks.report ) ) {

					scope.callbacks.report( {
						detail: {
							type: 'progressLoad',
							modelName: this.description,
							text: output,
							instanceNo: this.instanceNo,
							numericalValue: numericalValue

						}
					} );

				}
			}
		};

		var scopedOnReportError = function ( event ) {
			var url = ( resourceDescriptorCurrent === null ) ? '' : resourceDescriptorCurrent.url;
			var errorMessage = 'Error occurred while downloading "' + url + '"';
			scope.callbacks.onError( errorMessage, event );
		};

		var processResourcesProxy = function ( content ) {
			if ( THREE.MeshTransfer.Validator.isValid( onCompleteFileLoading ) ) {

				onCompleteFileLoading( content, index );

			}
		};

		var fileLoader = new THREE.FileLoader( this.manager );
		fileLoader.setResponseType( resourceDescriptorCurrent.parserConfiguration.payloadType );
		fileLoader.setPath( this.path );
		fileLoader.load( resourceDescriptorCurrent.url, processResourcesProxy, scopedOnReportProgress, scopedOnReportError );

	}
};

/**
 * Encapsulates the configuration for a complete {@link THREE.WorkerLoader.LoadingTask}.
 * @constructor
 */
THREE.WorkerLoader.LoadingTaskConfig = function ( ownConfig ) {
	this.loader = {
		classDef: null,
		config: {},
		buildWorkerCode: null
	};
	this.config = THREE.MeshTransfer.Validator.verifyInput( ownConfig, {} );
	this.resourceDescriptors = [];
	this.extension = 'unknown';

	this.callbacks = {
		app: {
			onReport: null,
			onReportError: null
		},
		parse: {
			onMesh: null,
			onMaterials: null
		},
		pipeline: {
			onComplete: null,
			onCompleteFileLoading: null,
			onCompleteParsing: null
		}
	};
};

THREE.WorkerLoader.LoadingTaskConfig.prototype = {

	constructor: THREE.WorkerLoader.LoadingTaskConfig,

	/**
	 *
	 * @param {String} loaderClassDef
	 * @param {Object} [loaderConfig]
	 * @returns {THREE.WorkerLoader.LoadingTaskConfig}
	 */
	setLoaderConfig: function ( loaderClassDef, loaderConfig ) {
		this.loader.classDef = THREE.MeshTransfer.Validator.verifyInput( loaderClassDef, this.loader.classDef );
		this.loader.config = THREE.MeshTransfer.Validator.verifyInput( loaderConfig, this.loader.config );
		return this;
	},

	/**
	 * Set the overall file extension associated with this LoaderTaskConfig
	 * @param extension
	 * @returns {THREE.WorkerLoader.LoadingTaskConfig}
	 */
	setExtension: function ( extension ) {
		this.extension = extension;
		return this;
	},

	/**
	 * Funtion that is invoked to build the worker code. This overrules anything the loader already supplies.
	 * @param buildWorkerCode
	 * @returns {THREE.WorkerLoader.LoadingTaskConfig}
	 */
	setBuildWorkerCodeFunction: function ( buildWorkerCode ) {
		this.loader.buildWorkerCode = buildWorkerCode;
		return this;
	},

	/**
	 *
	 * @param {THREE.WorkerLoader.ResourceDescriptor} resourceDescriptor
	 * @returns {THREE.WorkerLoader.LoadingTaskConfig}
	 */
	addResourceDescriptor: function ( resourceDescriptor ) {
		this.resourceDescriptors.push( resourceDescriptor );
		return this;
	},

	/**
	 *
	 * @param resourceDescriptor
	 * @returns {THREE.WorkerLoader.LoadingTaskConfig}
	 */
	setResourceDescriptors: function ( resourceDescriptors ) {
		this.resourceDescriptors = [];
		for ( var name in resourceDescriptors ) {

			this.resourceDescriptors.push( resourceDescriptors[ name ] );

		}
		return this;
	},

	/**
	 * Sets the callbacks used during parsing and for general reporting to the application context.
	 * @param {Function} [onMesh]
	 * @param {Function} [onMaterials]
	 * @returns {THREE.WorkerLoader.LoadingTaskConfig}
	 */
	setCallbacksParsing: function ( onMesh, onMaterials ) {
		this.callbacks.parse.onMesh = THREE.MeshTransfer.Validator.verifyInput( onMesh, this.callbacks.parse.onMesh );
		this.callbacks.parse.onMaterials = THREE.MeshTransfer.Validator.verifyInput( onMaterials, this.callbacks.parse.onMaterials );
		return this;
	},

	/**
	 *
	 * @param {Function} onComplete
	 * @param {Function} onCompleteLoad
	 * @param {Function} onCompleteParse
	 * @returns {THREE.WorkerLoader.LoadingTaskConfig}
	 */
	setCallbacksPipeline: function ( onComplete, onCompleteFileLoading, onCompleteParsing ) {
		this.callbacks.pipeline.onComplete = THREE.MeshTransfer.Validator.verifyInput( onComplete, this.callbacks.pipeline.onComplete );
		this.callbacks.pipeline.onCompleteFileLoading = THREE.MeshTransfer.Validator.verifyInput( onCompleteFileLoading, this.callbacks.pipeline.onCompleteFileLoading );
		this.callbacks.pipeline.onCompleteParsing = THREE.MeshTransfer.Validator.verifyInput( onCompleteParsing, this.callbacks.pipeline.onCompleteParsing );
		return this;
	},

	/**
	 *
	 * @param {Function} onReport
	 * @param {Function} [onReportError]
	 * @returns {THREE.WorkerLoader.LoadingTaskConfig}
	 */
	setCallbacksApp: function ( onReport, onReportError ) {
		this.callbacks.app.onReport = THREE.MeshTransfer.Validator.verifyInput( onReport, this.callbacks.app.onReport );
		this.callbacks.app.onReportError = THREE.MeshTransfer.Validator.verifyInput( onReportError, this.callbacks.app.onReportError );
		return this;
	}
};

/**
 *
 * @param {String} resourceType
 * @param {String} name
 * @param {Object} [input]
 * @constructor
 */
THREE.WorkerLoader.ResourceDescriptor = function ( resourceType, name, input ) {
	this.name = ( name !== undefined && name !== null ) ? name : 'Unnamed_Resource';
	this.resourceType = resourceType;

	this.content;
	this.url = null;
	this.filename = null;
	this.path = '';
	this.extension = null;
	this.async = {
		load: false,
		parse: true
	};
	this.parserConfiguration = {
		payloadType: 'arraybuffer'
	};
	this.dataOptions = {};
	this.transferables = [];
	this.result = null;

	this._init( input );
};

THREE.WorkerLoader.ResourceDescriptor.prototype = {

	constructor: THREE.WorkerLoader.ResourceDescriptor,

	_init: function ( input ) {
		input = ( input !== undefined && input !== null ) ? input : null;

		if ( this.resourceType === 'URL' ) {

			this.url = ( input !== null ) ? input : this.name;
			this.url = new URL( this.url, window.location.href ).href;
			this.filename = this.url;
			var urlParts = this.url.split( '/' );
			if ( urlParts.length > 2 ) {

				this.filename = urlParts[ urlParts.length - 1 ];
				var urlPartsPath = urlParts.slice( 0, urlParts.length - 1 ).join( '/' ) + '/';
				if ( urlPartsPath !== undefined && urlPartsPath !== null ) this.path = urlPartsPath;

			}
			var filenameParts = this.filename.split( '.' );
			if ( filenameParts.length > 1 ) this.extension = filenameParts[ filenameParts.length - 1 ];
			this.content = null;

		} else if ( this.resourceType === 'Buffer' ) {

			this.parserConfiguration.payloadType = 'arraybuffer';
			this.setBuffer( input );

		} else if ( this.resourceType === 'String' ) {

			this.parserConfiguration.payloadType = 'text';
			this.setString( input );

		} else if ( this.resourceType === 'Metadata' ) {

			this.content = 'no_content';

		} else {

			throw 'An unsupported resourceType "' + this.resourceType + '" was provided! Aborting...';

		}
	},

	setString: function ( input ) {
		// fast-fail on unset input
		if ( input === null ) return;
		if ( ! ( typeof( input ) === 'string' || input instanceof String) ) this._throwError( 'Provided input is not of resourceType "String"! Aborting...' );
		this.content = input;
	},

	setBuffer: function ( buffer ) {
		// fast-fail on unset input
		if ( buffer === null ) return;
		if ( ! ( buffer instanceof ArrayBuffer ||
			buffer instanceof Int8Array ||
			buffer instanceof Uint8Array ||
			buffer instanceof Uint8ClampedArray ||
			buffer instanceof Int16Array ||
			buffer instanceof Uint16Array ||
			buffer instanceof Int32Array ||
			buffer instanceof Uint32Array ||
			buffer instanceof Float32Array ||
			buffer instanceof Float64Array ) ) {

			this._throwError( 'Provided input is neither an "ArrayBuffer" nor a "TypedArray"! Aborting...' );

		}
		this.content = buffer;
	},

	configureAsync: function ( loadAsync, parseAsync ) {
		this.async.parse = parseAsync === true;
		// Loading in Worker is currently only allowed when async parse is performed!!!!
		this.async.load = loadAsync === true && this.async.parse;

		return this;
	},

	setParserConfiguration: function ( parserConfiguration ) {
		THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl.prototype.applyProperties( this.parserConfiguration, parserConfiguration, true );
		if ( this.parserConfiguration.name === undefined || this.parserConfiguration.name === null ) this.parserConfiguration.name = this.name;
		return this;
	},

	setDataOption: function ( name, object, transferables ) {
		if ( ! Array.isArray( transferables ) ) transferables = [];
		this.dataOptions[ name ] = {
			name: name,
			object: object
		};
		if ( transferables.length > 0 ) {

			this.transferables = this.transferables.concat( transferables );

		}
	},

	setParserResult: function ( result ) {
		this.result = result;
	},

	setCallbackOnProcessResult: function ( callbackOnProcessResult ) {
		this.callbackOnProcessResult = callbackOnProcessResult;
		return this;
	},

	getCallbackOnProcessResult: function ( ) {
		return this.callbackOnProcessResult;
	},

	createSendable: function () {
		var copy = new THREE.WorkerLoader.ResourceDescriptor( this.resourceType, this.name );
		copy.url = this.url;
		copy.filename = this.filename;
		copy.path = this.path;
		copy.extension = this.extension;
		copy.async.load = this.async.load;
		copy.async.parse = this.async.parse;
		copy.parserConfiguration.payloadType = this.parserConfiguration.payloadType;
		this.result = null;
		return copy;
	}
};


/**
 * This class provides means to transform existing parser code into a web worker. It defines a simple communication protocol
 * which allows to configure the worker and receive raw mesh data during execution.
 * @class
 */
THREE.WorkerLoader.WorkerSupport = function () {
	console.info( 'Using THREE.WorkerLoader.WorkerSupport version: ' + THREE.WorkerLoader.WorkerSupport.WORKER_SUPPORT_VERSION );

	// check worker support first
	if ( window.Worker === undefined ) throw "This browser does not support web workers!";
	if ( window.Blob === undefined ) throw "This browser does not support Blob!";
	if ( typeof window.URL.createObjectURL !== 'function' ) throw "This browser does not support Object creation from URL!";

	this._reset();
};
THREE.WorkerLoader.WorkerSupport.WORKER_SUPPORT_VERSION = '3.0.0-dev';

THREE.WorkerLoader.WorkerSupport.prototype = {

	constructor: THREE.WorkerLoader.WorkerSupport,

	_reset: function () {
		this.logging = {
			enabled: true,
			debug: false
		};

		var scope = this;
		var scopeTerminate = function (  ) {
			scope._terminate();
		};
		this.worker = {
			native: null,
			logging: true,
			workerRunner: {
				haveUserImpl: false,
				name: 'THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl',
				impl: THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl,
				parserName: null,
				usesMeshDisassembler: null,
				defaultGeometryType: null
			},
			terminateWorkerOnLoad: false,
			forceWorkerDataCopy: false,
			started: false,
			queuedMessage: null,
			callbacks: {
				dataReceiver: null,
				onLoad: null,
				terminate: scopeTerminate
			}
		};
	},

	/**
	 * Enable or disable logging in general (except warn and error), plus enable or disable debug logging.
	 *
	 * @param {boolean} enabled True or false.
	 * @param {boolean} debug True or false.
	 */
	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
		this.worker.logging = enabled === true;
		return this;
	},

	/**
	 * Forces all ArrayBuffers to be transferred to worker to be copied.
	 *
	 * @param {boolean} forceWorkerDataCopy True or false.
	 */
	setForceWorkerDataCopy: function ( forceWorkerDataCopy ) {
		this.worker.forceWorkerDataCopy = forceWorkerDataCopy === true;
		return this;
	},

	/**
	 * Request termination of worker once parser is finished.
	 *
	 * @param {boolean} terminateWorkerOnLoad True or false.
	 */
	setTerminateWorkerOnLoad: function ( terminateWorkerOnLoad ) {
		this.worker.terminateWorkerOnLoad = terminateWorkerOnLoad === true;
		if ( this.worker.terminateWorkerOnLoad && THREE.MeshTransfer.Validator.isValid( this.worker.native ) &&
				! THREE.MeshTransfer.Validator.isValid( this.worker.queuedMessage ) && this.worker.started ) {

			if ( this.logging.enabled ) console.info( 'Worker is terminated immediately as it is not running!' );
			this._terminate();

		}
		return this;
	},

	/**
	 * Set a user-defined runner embedding the worker code and  handling communication and execution with main.
	 *
	 * @param {object} userRunnerImpl The object reference
	 * @param {string} userRunnerImplName The name of the object
	 */
	setUserRunnerImpl: function ( userRunnerImpl, userRunnerImplName ) {
		if ( THREE.MeshTransfer.Validator.isValid( userRunnerImpl ) && THREE.MeshTransfer.Validator.isValid( userRunnerImplName ) ) {

			this.worker.workerRunner.haveUserImpl = true;
			this.worker.workerRunner.impl = userRunnerImpl;
			this.worker.workerRunner.name = userRunnerImplName;
			if ( this.logging.enabled ) console.info( 'WorkerSupport: Using "' + userRunnerImplName + '" as Runner class for worker.' );

		}
		return this;
	},

	/**
	 * Update all callbacks.
	 *
	 * @param {Function} dataReceiver The function for processing the data, e.g. {@link THREE.MeshTransfer.MeshReceiver}.
	 * @param {Function} [onLoad] The function that is called when parsing is complete.
	 */
	updateCallbacks: function ( dataReceiver, onLoad ) {
		this.worker.callbacks.dataReceiver = THREE.MeshTransfer.Validator.verifyInput( dataReceiver, this.worker.callbacks.dataReceiver );
		this.worker.callbacks.onLoad = THREE.MeshTransfer.Validator.verifyInput( onLoad, this.worker.callbacks.onLoad );
		this._verifyCallbacks();
	},

	_verifyCallbacks: function () {
		if ( ! THREE.MeshTransfer.Validator.isValid( this.worker.callbacks.dataReceiver ) ) throw 'Unable to run as no "dataReceiver" callback is set.';
	},

	/**
	 * Validate the status of worker code and the derived worker and specify functions that should be build when new raw mesh data becomes available and when the parser is finished.
	 *
	 * @param {Function} buildWorkerCode The function that is invoked to create the worker code of the parser.
	 */
	validate: function ( loaderRef, buildWorkerCode, containFileLoadingCode ) {
		if ( THREE.MeshTransfer.Validator.isValid( this.worker.native ) ) return;
		if ( this.logging.enabled ) {

			console.info( 'WorkerSupport: Building worker code...' );
			console.time( 'buildWebWorkerCode' );
			if ( ! this.worker.workerRunner.haveUserImpl ) console.info( 'WorkerSupport: Using DEFAULT "' + this.worker.workerRunner.name + '" as Runner class for worker.' );

		}
		var codeBuilderInstructions = {
			code: '',
			parserName: 'Parser',
			provideThree: false
		};
		if ( THREE.MeshTransfer.Validator.isValid( buildWorkerCode ) ) {

			codeBuilderInstructions = buildWorkerCode( THREE.WorkerLoader.WorkerSupport.CodeSerializer, loaderRef );

		}
		// Enforce codeBuilderInstructions flag for availability of three code
		if ( THREE.MeshTransfer.Validator.isValid( codeBuilderInstructions.provideThree ) ) {

			codeBuilderInstructions.provideThree = codeBuilderInstructions.provideThree === true;

		} else {

			throw '"buildWorkerCode" did not define boolean "provideThree" which tells "WorkerSupport" whether three.js is already contained in worker code.'

		}
		var userWorkerCode = codeBuilderInstructions.code;
		userWorkerCode += 'THREE.MeshTransfer = {};\n\n';
		userWorkerCode += 'THREE.WorkerLoader = {\n\tWorkerSupport: {},\n\tParser: ' + codeBuilderInstructions.parserName + '\n};\n\n';
		if ( codeBuilderInstructions.containsMeshDisassembler === true || codeBuilderInstructions.usesMeshDisassembler === true ) {

			userWorkerCode += THREE.WorkerLoader.WorkerSupport.CodeSerializer.serializeClass( 'THREE.MeshTransfer.MeshTransmitter', THREE.MeshTransfer.MeshTransmitter );

		}
		userWorkerCode += THREE.WorkerLoader.WorkerSupport.CodeSerializer.serializeObject( 'THREE.MeshTransfer.Validator', THREE.MeshTransfer.Validator );
		if ( containFileLoadingCode ) {

			if ( ! codeBuilderInstructions.provideThree ) {

				userWorkerCode += 'var loading = {};\n\n';
				userWorkerCode += THREE.WorkerLoader.WorkerSupport.CodeSerializer.serializeObject( 'THREE.Cache', THREE.Cache );
				userWorkerCode += THREE.DefaultLoadingManager.constructor.toString();
				userWorkerCode += 'var DefaultLoadingManager = new LoadingManager();\n\n';
				userWorkerCode += 'var Cache = THREE.Cache;\n\n';
				userWorkerCode += THREE.WorkerLoader.WorkerSupport.CodeSerializer.serializeClass( 'THREE.FileLoader', THREE.FileLoader, 'FileLoader' );

			}
			userWorkerCode += THREE.WorkerLoader.WorkerSupport.CodeSerializer.serializeClass( 'THREE.WorkerLoader.ResourceDescriptor', THREE.WorkerLoader.ResourceDescriptor );
			userWorkerCode += THREE.WorkerLoader.WorkerSupport.CodeSerializer.serializeClass( 'THREE.WorkerLoader.FileLoadingExecutor', THREE.WorkerLoader.FileLoadingExecutor );

		}
		userWorkerCode += THREE.WorkerLoader.WorkerSupport.CodeSerializer.serializeClass( this.worker.workerRunner.name, this.worker.workerRunner.impl );
		userWorkerCode += 'new ' + this.worker.workerRunner.name + '();\n\n';

		var scope = this;
		var scopedReceiveWorkerMessage = function ( event ) {
			scope._receiveWorkerMessage( event );
		};
		var initWorker = function ( stringifiedCode ) {
			var blob = new Blob( [ stringifiedCode ], { type: 'application/javascript' } );
			scope.worker.native = new Worker( window.URL.createObjectURL( blob ) );
			scope.worker.native.onmessage = scopedReceiveWorkerMessage;
			scope.worker.workerRunner.usesMeshDisassembler = codeBuilderInstructions.usesMeshDisassembler;
			scope.worker.workerRunner.defaultGeometryType = THREE.MeshTransfer.Validator.verifyInput( codeBuilderInstructions.defaultGeometryType, 0 );

			// process stored queuedMessage
			scope._postMessage();
		};

		if ( THREE.MeshTransfer.Validator.isValid( codeBuilderInstructions.libs ) &&
				THREE.MeshTransfer.Validator.isValid( codeBuilderInstructions.libs.locations ) &&
				codeBuilderInstructions.libs.locations.length > 0 ) {

			var libsContent = '';
			var loadAllLibraries = function ( path, locations ) {
				if ( locations.length === 0 ) {

					initWorker( libsContent + '\n\n' + userWorkerCode );
					if ( scope.logging.enabled ) console.timeEnd( 'buildWebWorkerCode' );

				} else {

					var loadedLib = function ( contentAsString ) {
						libsContent += contentAsString;
						loadAllLibraries( path, locations );
					};

					var fileLoader = new THREE.FileLoader();
					fileLoader.setPath( path );
					fileLoader.setResponseType( 'text' );
					fileLoader.load( locations[ 0 ], loadedLib );
					locations.shift();

				}
			};
			codeBuilderInstructions.libs.path = THREE.MeshTransfer.Validator.verifyInput( codeBuilderInstructions.libs.path, '' );
			loadAllLibraries( codeBuilderInstructions.libs.path, codeBuilderInstructions.libs.locations );

		} else {

			initWorker( userWorkerCode );
			if ( this.logging.enabled ) console.timeEnd( 'buildWebWorkerCode' );

		}
	},

	/**
	 * Executed in worker scope
	 */
	_receiveWorkerMessage: function ( event ) {
		var payload = event.data;
		switch ( payload.cmd ) {
			case 'data':
				this.worker.callbacks.dataReceiver( payload );
				break;

			case 'confirm':
				if ( payload.type === 'initWorkerDone' ) {

					this.worker.queuedMessage = null;
					this.worker.callbacks.dataReceiver( payload );

				} else if ( payload.type === 'fileLoaded' ) {

					this.worker.queuedMessage = null;
					this.worker.callbacks.dataReceiver( null, payload.params.index );
				}
				break;

			case 'completeOverall':
				this.worker.queuedMessage = null;
				this.worker.started = false;
				if ( THREE.MeshTransfer.Validator.isValid( this.worker.callbacks.onLoad ) ) this.worker.callbacks.onLoad( payload.msg );

				if ( this.worker.terminateWorkerOnLoad ) {

					if ( this.worker.logging.enabled ) console.info( 'WorkerSupport [' + this.worker.workerRunner.name + ']: Run is complete. Terminating application on request!' );
					this.worker.callbacks.terminate();

				}
				break;

			case 'error':
				console.error( 'WorkerSupport [' + this.worker.workerRunner.name + ']: Reported error: ' + payload.msg );
				this.worker.queuedMessage = null;
				this.worker.started = false;
				if ( THREE.MeshTransfer.Validator.isValid( this.worker.callbacks.onLoad ) ) this.worker.callbacks.onLoad( payload.msg );

				if ( this.worker.terminateWorkerOnLoad ) {

					if ( this.worker.logging.enabled ) console.info( 'WorkerSupport [' + this.worker.workerRunner.name + ']: Run reported error. Terminating application on request!' );
					this.worker.callbacks.terminate();

				}
				break;

			default:
				console.error( 'WorkerSupport [' + this.worker.workerRunner.name + ']: Received unknown command: ' + payload.cmd );
				break;

		}
	},

	runAsyncInitWorker: function ( resourceDescriptors ) {
		var payload = {
			cmd: 'initWorker',
			logging: {
				enabled: this.logging.enabled,
				debug: this.logging.debug
			},
			data: {
				resourceDescriptors: resourceDescriptors
			}
		};
		if ( ! this._verifyWorkerIsAvailable( payload ) ) return;

		this._postMessage();
	},

	/**
	 * Runs the file loading in worker with the provided configuration.
	 *
	 * @param {Object} payload configuration required for loading files.
	 */
	runAsyncLoad: function ( payload ) {
		payload.cmd = 'loadFile';
		payload.data = {};
		if ( ! this._verifyWorkerIsAvailable( payload ) ) return;

		this._postMessage();
	},

	/**
	 * Runs the parser with the provided configuration.
	 *
	 * @param {Object} payload Raw mesh description (buffers, params, materials) used to build one to many meshes.
	 */
	runAsyncParse: function( payload, transferables ) {
		payload.cmd = 'parse';
		payload.usesMeshDisassembler = this.worker.workerRunner.usesMeshDisassembler;
		payload.defaultGeometryType = this.worker.workerRunner.defaultGeometryType;
		if ( ! this._verifyWorkerIsAvailable( payload, transferables ) ) return;

		this._postMessage();
	},

	_verifyWorkerIsAvailable: function ( payload, transferables ) {
		this._verifyCallbacks();
		var ready = true;
		if ( THREE.MeshTransfer.Validator.isValid( this.worker.queuedMessage ) ) {

			console.warn( 'Already processing message. Rejecting new run instruction' );
			ready = false;

		} else {

			this.worker.queuedMessage = {
				payload: payload,
				transferables: transferables
			};
			this.worker.started = true;

		}
		return ready;
	},

	_postMessage: function () {
		if ( THREE.MeshTransfer.Validator.isValid( this.worker.queuedMessage ) && THREE.MeshTransfer.Validator.isValid( this.worker.native ) ) {

			if ( this.worker.queuedMessage.payload.data.input instanceof ArrayBuffer ) {

				var transferables = [];
				if ( this.worker.forceWorkerDataCopy ) {

					transferables.push( this.worker.queuedMessage.payload.data.input.slice( 0 ) );

				} else {

					transferables.push( this.worker.queuedMessage.payload.data.input );

				}
				if ( this.worker.queuedMessage.transferables.length > 0 ) {

					transferables = transferables.concat( this.worker.queuedMessage.transferables );

				}
				this.worker.native.postMessage( this.worker.queuedMessage.payload, transferables );

			} else {

				this.worker.native.postMessage( this.worker.queuedMessage.payload );

			}

		}
	},

	_terminate: function () {
		this.worker.native.terminate();
		this._reset();
	}
};


THREE.WorkerLoader.WorkerSupport.CodeSerializer = {

	/**
	 *
	 * @param fullName
	 * @param object
	 * @returns {string}
	 */
	serializeObject: function ( fullName, object ) {
		var objectString = fullName + ' = {\n\n';
		var part;
		for ( var name in object ) {

			part = object[ name ];
			if ( typeof( part ) === 'string' || part instanceof String ) {

				part = part.replace( '\n', '\\n' );
				part = part.replace( '\r', '\\r' );
				objectString += '\t' + name + ': "' + part + '",\n';

			} else if ( part instanceof Array ) {

				objectString += '\t' + name + ': [' + part + '],\n';

			} else if ( typeof part === 'object' ) {

				// TODO: Short-cut for now. Recursion required?
				objectString += '\t' + name + ': {},\n';

			} else {

				objectString += '\t' + name + ': ' + part + ',\n';

			}

		}
		objectString += '}\n\n';

		return objectString;
	},

	/**
	 *
	 * @param fullName
	 * @param object
	 * @param basePrototypeName
	 * @param ignoreFunctions
	 * @returns {string}
	 */
	serializeClass: function ( fullName, object, constructorName, basePrototypeName, ignoreFunctions, includeFunctions, overrideFunctions ) {
		var valueString, objectPart, constructorString, i, funcOverride;
		var prototypeFunctions = [];
		var objectProperties = [];
		var objectFunctions = [];
		var isExtended = ( basePrototypeName !== null && basePrototypeName !== undefined );

		if ( ! Array.isArray( ignoreFunctions ) ) ignoreFunctions = [];
		if ( ! Array.isArray( includeFunctions ) ) includeFunctions = null;
		if ( ! Array.isArray( overrideFunctions ) ) overrideFunctions = [];

		for ( var name in object.prototype ) {

			objectPart = object.prototype[ name ];
			valueString = objectPart.toString();
			if ( name === 'constructor' ) {

				constructorString = fullName + ' = ' + valueString + ';\n\n';

			} else if ( typeof objectPart === 'function' ) {

				if ( ignoreFunctions.indexOf( name ) < 0 && ( includeFunctions === null || includeFunctions.indexOf( name ) >= 0 ) ) {

					funcOverride = overrideFunctions[ name ];
					if ( funcOverride && funcOverride.fullName === fullName + '.prototype.' + name ) {

						valueString = funcOverride.code;

					}
					if ( isExtended ) {

						prototypeFunctions.push( fullName + '.prototype.' + name + ' = ' + valueString + ';\n\n' );

					} else {

						prototypeFunctions.push( '\t' + name + ': ' + valueString + ',\n\n' );

					}
				}

			}

		}
		for ( var name in object ) {

			objectPart = object[ name ];

			if ( typeof objectPart === 'function' ) {

				if ( ignoreFunctions.indexOf( name ) < 0 && ( includeFunctions === null || includeFunctions.indexOf( name ) >= 0 ) ) {

					funcOverride = overrideFunctions[ name ];
					if ( funcOverride && funcOverride.fullName === fullName + '.' + name ) {

						valueString = funcOverride.code;

					} else {

						valueString = objectPart.toString();

					}
					objectFunctions.push( fullName + '.' + name + ' = ' + valueString + ';\n\n' );

				}

			} else {

				if ( typeof( objectPart ) === 'string' || objectPart instanceof String) {

					valueString = '\"' + objectPart.toString() + '\"';

				} else if ( typeof objectPart === 'object' ) {

					// TODO: Short-cut for now. Recursion required?
					valueString = "{}";

				} else {

					valueString = objectPart;

				}
				objectProperties.push( fullName + '.' + name + ' = ' + valueString + ';\n' );

			}

		}
		if ( ( constructorString === undefined || constructorString === null ) && typeof object.prototype.constructor === 'function' ) {

			constructorString = fullName + ' = ' + object.prototype.constructor.toString().replace( constructorName, '' );

		}
		var objectString = constructorString + '\n\n';
		if ( isExtended ) {

			objectString += fullName + '.prototype = Object.create( ' + basePrototypeName + '.prototype );\n';

		}
		objectString += fullName + '.prototype.constructor = ' + fullName + ';\n';
		objectString += '\n\n';

		for ( i = 0; i < objectProperties.length; i ++ ) objectString += objectProperties[ i ];
		objectString += '\n\n';

		for ( i = 0; i < objectFunctions.length; i ++ ) objectString += objectFunctions[ i ];
		objectString += '\n\n';

		if ( isExtended ) {

			for ( i = 0; i < prototypeFunctions.length; i ++ ) objectString += prototypeFunctions[ i ];

		} else {

			objectString += fullName + '.prototype = {\n\n';
			for ( i = 0; i < prototypeFunctions.length; i ++ ) objectString += prototypeFunctions[ i ];
			objectString += '\n};';

		}
		objectString += '\n\n';

		return objectString;
	},
};


/**
 * Default implementation of the WorkerRunner responsible for creation and configuration of the parser within the worker.
 * @constructor
 */
THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl = function () {
	this.resourceDescriptors = [];
	this.logging = {
		enabled: false,
		debug: false
	};

	var scope = this;
	var scopedRunner = function( event ) {
		scope.processMessage( event.data );
	};
	self.addEventListener( 'message', scopedRunner, false );
};

THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl.prototype = {

	constructor: THREE.WorkerLoader.WorkerSupport._WorkerRunnerRefImpl,

	/**
	 * Applies values from parameter object via set functions or via direct assignment.
	 *
	 * @param {Object} parser The parser instance
	 * @param {Object} params The parameter object
	 */
	applyProperties: function ( parser, params, forceCreation ) {
		// fast-fail
		if ( parser === undefined || parser === null || params === undefined || params === null ) return;

		var property, funcName, values;
		for ( property in params ) {
			funcName = 'set' + property.substring( 0, 1 ).toLocaleUpperCase() + property.substring( 1 );
			values = params[ property ];

			if ( typeof parser[ funcName ] === 'function' ) {

				parser[ funcName ]( values );

			} else if ( parser.hasOwnProperty( property ) || forceCreation ) {

				parser[ property ] = values;

			}
		}
	},

	/**
	 * Configures the Parser implementation according the supplied configuration object.
	 *
	 * @param {Object} payload Raw mesh description (buffers, params, materials) used to build one to many meshes.
	 */
	processMessage: function ( payload ) {
		var scope = this;
		if ( payload.cmd === 'initWorker' ) {

			this.logging.enabled = payload.logging.enabled === true;
			this.logging.debug = payload.logging.debug === true;
			if ( payload.data.resourceDescriptors !== null && this.resourceDescriptors.length === 0 ) {

				for ( var name in payload.data.resourceDescriptors ) this.resourceDescriptors.push( payload.data.resourceDescriptors[ name ] );

			}
			self.postMessage( {
				cmd: 'confirm',
				type: 'initWorkerDone',
				msg: 'Worker init has been successfully performed.'
			} );

		} else if ( payload.cmd === 'loadFile' ) {

			var resourceDescriptorCurrent = this.resourceDescriptors[ payload.params.index ];
			var fileLoadingExecutor = new THREE.WorkerLoader.FileLoadingExecutor( payload.params.instanceNo, payload.params.description );

			var callbackProgress = function ( text ) {
				if ( scope.logging.enabled && scope.logging.debug ) console.debug( 'WorkerRunner: progress: ' + text );
			};
			var callbackError = function ( message ) {
				console.error( message );
			};
			fileLoadingExecutor
				.setPath( payload.params.path )
				.setCallbacks( callbackProgress, callbackError );

			var confirmFileLoaded = function ( content, completedIndex ) {
				if ( THREE.MeshTransfer.Validator.isValid( content ) ) scope.resourceDescriptors[ completedIndex ].content = content;
				self.postMessage( {
					cmd: 'confirm',
					type: 'fileLoaded',
					params: {
						index: completedIndex
					}
				} );
			};
			fileLoadingExecutor.loadFile( resourceDescriptorCurrent, payload.params.index, confirmFileLoaded );

		} else if ( payload.cmd === 'parse' ) {

			var callbacks = {
				callbackDataReceiver: function ( payload ) {
					self.postMessage( payload );
				},
				callbackProgress: function ( text ) {
					if ( scope.logging.enabled && scope.logging.debug ) console.debug( 'WorkerRunner: progress: ' + text );
				}
			};

			// Parser is expected to be named as such
			var parser = new THREE.WorkerLoader.Parser();
			if ( typeof parser[ 'setLogging' ] === 'function' ) {

				parser.setLogging( this.logging.enabled, this.logging.debug );

			}
			this.applyProperties( parser, payload.params );
			this.applyProperties( parser, payload.materials );
			this.applyProperties( parser, callbacks );

			var arraybuffer;
			if ( THREE.MeshTransfer.Validator.isValid( payload.params.index ) ) {

				arraybuffer = this.resourceDescriptors[ payload.params.index ].content;

			} else {

				arraybuffer = payload.data.input;

			}

			var parseFunctionName = 'parse';
			if ( typeof parser.getParseFunctionName === 'function' ) parseFunctionName = parser.getParseFunctionName();
			if ( payload.usesMeshDisassembler ) {

				var object3d = parser[ parseFunctionName ] ( arraybuffer, payload.data.options );
				var meshTransmitter = new THREE.MeshTransfer.MeshTransmitter();

				meshTransmitter.setDefaultGeometryType( payload.defaultGeometryType );
				meshTransmitter.setCallbackDataReceiver( callbacks.callbackDataReceiver );
				meshTransmitter.walkMesh( object3d );

			} else {

				parser[ parseFunctionName ] ( arraybuffer, payload.data.options );

			}
			if ( this.logging.enabled ) console.log( 'WorkerRunner: Run complete!' );

			self.postMessage( {
				cmd: 'completeOverall',
				msg: 'WorkerRunner completed run.'
			} );

		} else {

			console.error( 'WorkerRunner: Received unknown command: ' + payload.cmd );

		}
	}
};
