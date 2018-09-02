import { Layer } from './Layer';
import { FeatureMap } from '../../elements/FeatureMap';
import { colorUtils } from '../../utils/ColorUtils';
import { fmCenterGenerator } from '../../utils/FmCenterGenerator';
import { LayerOpenFactory } from "../../animation/LayerOpen";
import { LayerCloseFactory } from "../../animation/LayerClose";
import { MapAggregation } from "../../elements/MapAggregation";

function Conv2d(config) {

	Layer.call(this, config);

	console.log("construct prime Conv2d");

	this.kernelSize = config.kernelSize;
	this.filters = config.filters;
	this.strides = config.strides;
	this.fmShape = undefined;
	this.width = undefined;
	this.height = undefined;
	this.depth = config.filters;

	this.fmCenters = [];
	this.openFmCenters = [];
	this.closeFmCenters = [];

	for (let i = 0; i < this.depth; i++) {
		let center = {
			x: 0,
			y: 0,
			z: 0
		};
		this.closeFmCenters.push(center);
	}

	this.layerType = "prime conv2d";

	if (config.shape !== undefined) {

		this.isShapePredefined = true;
		this.fmShape = config.shape;
		this.width = this.fmShape[0];
		this.height = this.fmShape[1];

	} else {
		this.isShapePredefined = false;
	}

	this.isOpen = undefined;
	this.layerShape = undefined;
	this.closeButton = undefined;

}

Conv2d.prototype = Object.assign(Object.create(Layer.prototype), {

	init: function (center, actualDepth) {

		this.center = center;
		this.actualDepth = actualDepth;
		this.openFmCenters = fmCenterGenerator.getFmCenters(this.layerShape, this.filters, this.actualWidth, this.actualHeight);
		this.leftMostCenter = this.openFmCenters[0];
		this.openHeight = this.actualHeight + this.openFmCenters[this.openFmCenters.length - 1].z - this.openFmCenters[0].z;

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set(this.center.x, this.center.y, this.center.z);

		if (this.isOpen) {
			for (let i = 0; i < this.openFmCenters.length; i++) {
				this.fmCenters.push(this.openFmCenters[i]);
			}
			this.initSegregationElements(this.openFmCenters);
			this.initCloseButton();
		} else {
			this.initAggregationElement();
		}

		this.scene.add(this.neuralGroup);

	},

	openLayer: function () {

		console.log("open layer");

		if (!this.isOpen) {

			this.disposeAggregationElement();
			this.initSegregationElements(this.closeFmCenters);
			LayerOpenFactory.openMapLayer(this);

		}


	},

	closeLayer: function () {

		console.log("close layer");

		if (this.isOpen) {

			LayerCloseFactory.closeMapLayer(this);

		}

	},

	initSegregationElements: function (centers) {

		for (let i = 0; i < this.filters; i++) {
			let segregationHandler = new FeatureMap(
				this.width,
				this.height,
				this.actualWidth,
				this.actualHeight,
				centers[i],
				this.color
			);
			segregationHandler.setLayerIndex(this.layerIndex);
			this.segregationHandlers.push(segregationHandler);
			this.neuralGroup.add(segregationHandler.getElement());
		}

		if (this.neuralValue !== undefined) {
			this.updateSegregationVis();
		}

	},

	disposeSegregationElements: function () {

		for (let i = 0; i < this.segregationHandlers.length; i++) {
			let segregationHandler = this.segregationHandlers[i];
			this.neuralGroup.remove(segregationHandler.getElement());
		}

		this.segregationHandlers = [];

	},

	initAggregationElement: function () {

		let aggregationHandler = new MapAggregation(
			this.width,
			this.height,
			this.actualWidth,
			this.actualHeight,
			this.actualDepth,
			this.color
		);
		aggregationHandler.setLayerIndex(this.layerIndex);

		this.aggregationHandler = aggregationHandler;
		this.neuralGroup.add(this.aggregationHandler.getElement());

	},

	disposeAggregationElement: function () {

		this.neuralGroup.remove(this.aggregationHandler.getElement());
		this.aggregationHandler = undefined;

	},

	assemble: function (layerIndex, modelConfig) {

		console.log("Assemble conv2d, layer index: " + layerIndex);

		this.layerIndex = layerIndex;

		if (this.isShapePredefined) {

		} else {
			this.inputShape = this.lastLayer.outputShape;
			this.width = (this.inputShape[0] - this.kernelSize) / this.strides + 1;
			this.height = (this.inputShape[1] - this.kernelSize) / this.strides + 1;
			this.fmShape = [this.width, this.height];
		}

		this.outputShape = [this.width, this.height, this.filters];

		this.realVirtualRatio = this.lastLayer.realVirtualRatio;
		this.actualWidth = this.width * this.realVirtualRatio;
		this.actualHeight = this.height * this.realVirtualRatio;

		if (this.isOpen === undefined) {

			this.isOpen = modelConfig.layerInitStatus;
		}

		if (this.color === undefined) {
			this.color = modelConfig.color.conv;
		}

		if (this.layerShape === undefined) {
			this.layerShape = modelConfig.layerShape;
		}

	},

	updateValue: function (value) {

		this.neuralValue = value;

		if (this.isOpen) {
			this.updateSegregationVis();
		} else {
			this.updateAggregationVis();
		}
	},

	updateAggregationVis: function() {

	},

	updateSegregationVis: function() {

		let layerOutputValues = [];

		for (let j = 0; j < this.depth; j++) {

			let referredIndex = j;

			while (referredIndex < this.neuralValue.length) {

				layerOutputValues.push(this.neuralValue[referredIndex]);

				referredIndex += this.depth;
			}

		}

		let colors = colorUtils.getAdjustValues(layerOutputValues);

		let featureMapSize = this.width * this.height;

		for (let i = 0; i < this.depth; i++) {

			this.segregationHandlers[i].updateVis(colors.slice(i * featureMapSize, (i + 1) * featureMapSize));

		}

	},

	getRelativeElements: function(selectedElement) {

		let relativeElements = [];

		if (selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "featureMap") {

			if (this.lastLayer.isOpen) {

				for (let i = 0; i < this.lastLayer.segregationHandlers.length; i++) {
					relativeElements.push(this.lastLayer.segregationHandlers[i].getElement());
				}

			} else {

				relativeElements.push(this.lastLayer.aggregationHandler.getElement());

			}

		} else {
			console.error("Oops, why raycaster selected this element?");
		}

		return relativeElements;

	}

});

export { Conv2d };