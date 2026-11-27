// Offline index of official buildingSMART release schemas. See ifc-entity-catalog-SOURCES.md.
// A trailing * in the source tokens denotes an EXPRESS ABSTRACT entity, not part of its IFC code.
const UDPSIfcCatalog = (() => {
  const makeVersion = (id, label, source) => Object.freeze({
    id,
    label,
    entities: Object.freeze(source.trim().split(/\s+/).map(token => Object.freeze({
      code: token.replace(/\*$/, ""),
      abstract: token.endsWith("*")
    })))
  });
  const versions = Object.freeze([
    makeVersion("IFC2X3", "IFC2x3", `
      IfcActionRequest IfcActor IfcActuatorType IfcAirTerminalBoxType IfcAirTerminalType IfcAirToAirHeatRecoveryType
      IfcAlarmType IfcAnnotation IfcAsset IfcBeam IfcBeamType IfcBoilerType IfcBuilding IfcBuildingElement*
      IfcBuildingElementComponent* IfcBuildingElementPart IfcBuildingElementProxy IfcBuildingElementProxyType
      IfcBuildingElementType* IfcBuildingStorey IfcCableCarrierFittingType IfcCableCarrierSegmentType
      IfcCableSegmentType IfcChamferEdgeFeature IfcChillerType IfcCoilType IfcColumn IfcColumnType IfcCompressorType
      IfcCondenserType IfcCondition IfcConditionCriterion IfcConstructionEquipmentResource
      IfcConstructionMaterialResource IfcConstructionProductResource IfcConstructionResource* IfcControl*
      IfcControllerType IfcCooledBeamType IfcCoolingTowerType IfcCostItem IfcCostSchedule IfcCovering
      IfcCoveringType IfcCrewResource IfcCurtainWall IfcCurtainWallType IfcDamperType IfcDiscreteAccessory
      IfcDiscreteAccessoryType IfcDistributionChamberElement IfcDistributionChamberElementType
      IfcDistributionControlElement IfcDistributionControlElementType* IfcDistributionElement
      IfcDistributionElementType IfcDistributionFlowElement IfcDistributionFlowElementType* IfcDistributionPort
      IfcDoor IfcDoorStyle IfcDuctFittingType IfcDuctSegmentType IfcDuctSilencerType IfcEdgeFeature*
      IfcElectricApplianceType IfcElectricDistributionPoint IfcElectricFlowStorageDeviceType
      IfcElectricGeneratorType IfcElectricHeaterType IfcElectricMotorType IfcElectricTimeControlType
      IfcElectricalCircuit IfcElectricalElement IfcElement* IfcElementAssembly IfcElementComponent*
      IfcElementComponentType* IfcElementType* IfcEnergyConversionDevice IfcEnergyConversionDeviceType*
      IfcEquipmentElement IfcEquipmentStandard IfcEvaporativeCoolerType IfcEvaporatorType IfcFanType IfcFastener
      IfcFastenerType IfcFeatureElement* IfcFeatureElementAddition* IfcFeatureElementSubtraction* IfcFilterType
      IfcFireSuppressionTerminalType IfcFlowController IfcFlowControllerType* IfcFlowFitting IfcFlowFittingType*
      IfcFlowInstrumentType IfcFlowMeterType IfcFlowMovingDevice IfcFlowMovingDeviceType* IfcFlowSegment
      IfcFlowSegmentType* IfcFlowStorageDevice IfcFlowStorageDeviceType* IfcFlowTerminal IfcFlowTerminalType*
      IfcFlowTreatmentDevice IfcFlowTreatmentDeviceType* IfcFooting IfcFurnishingElement IfcFurnishingElementType
      IfcFurnitureStandard IfcFurnitureType IfcGasTerminalType IfcGrid IfcGroup IfcHeatExchangerType
      IfcHumidifierType IfcInventory IfcJunctionBoxType IfcLaborResource IfcLampType IfcLightFixtureType
      IfcMechanicalFastener IfcMechanicalFastenerType IfcMember IfcMemberType IfcMotorConnectionType IfcMove
      IfcObject* IfcObjectDefinition* IfcOccupant IfcOpeningElement IfcOrderAction IfcOutletType
      IfcPerformanceHistory IfcPermit IfcPile IfcPipeFittingType IfcPipeSegmentType IfcPlate IfcPlateType IfcPort*
      IfcProcedure IfcProcess* IfcProduct* IfcProject IfcProjectOrder IfcProjectOrderRecord IfcProjectionElement
      IfcProtectiveDeviceType IfcProxy IfcPumpType IfcRailing IfcRailingType IfcRamp IfcRampFlight IfcRampFlightType
      IfcReinforcingBar IfcReinforcingElement* IfcReinforcingMesh IfcResource* IfcRoof IfcRoundedEdgeFeature
      IfcSanitaryTerminalType IfcScheduleTimeControl IfcSensorType IfcServiceLife IfcSite IfcSlab IfcSlabType
      IfcSpace IfcSpaceHeaterType IfcSpaceProgram IfcSpaceType IfcSpatialStructureElement*
      IfcSpatialStructureElementType* IfcStackTerminalType IfcStair IfcStairFlight IfcStairFlightType
      IfcStructuralAction* IfcStructuralActivity* IfcStructuralAnalysisModel IfcStructuralConnection*
      IfcStructuralCurveConnection IfcStructuralCurveMember IfcStructuralCurveMemberVarying IfcStructuralItem*
      IfcStructuralLinearAction IfcStructuralLinearActionVarying IfcStructuralLoadGroup IfcStructuralMember*
      IfcStructuralPlanarAction IfcStructuralPlanarActionVarying IfcStructuralPointAction
      IfcStructuralPointConnection IfcStructuralPointReaction IfcStructuralReaction* IfcStructuralResultGroup
      IfcStructuralSurfaceConnection IfcStructuralSurfaceMember IfcStructuralSurfaceMemberVarying
      IfcSubContractResource IfcSwitchingDeviceType IfcSystem IfcSystemFurnitureElementType IfcTankType IfcTask
      IfcTendon IfcTendonAnchor IfcTimeSeriesSchedule IfcTransformerType IfcTransportElement IfcTransportElementType
      IfcTubeBundleType IfcTypeObject IfcTypeProduct IfcUnitaryEquipmentType IfcValveType IfcVibrationIsolatorType
      IfcVirtualElement IfcWall IfcWallStandardCase IfcWallType IfcWasteTerminalType IfcWindow IfcWindowStyle
      IfcWorkControl* IfcWorkPlan IfcWorkSchedule IfcZone
    `),
    makeVersion("IFC4", "IFC4", `
      IfcActionRequest IfcActor IfcActuator IfcActuatorType IfcAirTerminal IfcAirTerminalBox IfcAirTerminalBoxType
      IfcAirTerminalType IfcAirToAirHeatRecovery IfcAirToAirHeatRecoveryType IfcAlarm IfcAlarmType IfcAnnotation
      IfcAsset IfcAudioVisualAppliance IfcAudioVisualApplianceType IfcBeam IfcBeamStandardCase IfcBeamType IfcBoiler
      IfcBoilerType IfcBuilding IfcBuildingElement* IfcBuildingElementPart IfcBuildingElementPartType
      IfcBuildingElementProxy IfcBuildingElementProxyType IfcBuildingElementType* IfcBuildingStorey
      IfcBuildingSystem IfcBurner IfcBurnerType IfcCableCarrierFitting IfcCableCarrierFittingType
      IfcCableCarrierSegment IfcCableCarrierSegmentType IfcCableFitting IfcCableFittingType IfcCableSegment
      IfcCableSegmentType IfcChiller IfcChillerType IfcChimney IfcChimneyType IfcCivilElement IfcCivilElementType
      IfcCoil IfcCoilType IfcColumn IfcColumnStandardCase IfcColumnType IfcCommunicationsAppliance
      IfcCommunicationsApplianceType IfcCompressor IfcCompressorType IfcCondenser IfcCondenserType
      IfcConstructionEquipmentResource IfcConstructionEquipmentResourceType IfcConstructionMaterialResource
      IfcConstructionMaterialResourceType IfcConstructionProductResource IfcConstructionProductResourceType
      IfcConstructionResource* IfcConstructionResourceType* IfcContext* IfcControl* IfcController IfcControllerType
      IfcCooledBeam IfcCooledBeamType IfcCoolingTower IfcCoolingTowerType IfcCostItem IfcCostSchedule IfcCovering
      IfcCoveringType IfcCrewResource IfcCrewResourceType IfcCurtainWall IfcCurtainWallType IfcDamper IfcDamperType
      IfcDiscreteAccessory IfcDiscreteAccessoryType IfcDistributionChamberElement IfcDistributionChamberElementType
      IfcDistributionCircuit IfcDistributionControlElement IfcDistributionControlElementType* IfcDistributionElement
      IfcDistributionElementType IfcDistributionFlowElement IfcDistributionFlowElementType* IfcDistributionPort
      IfcDistributionSystem IfcDoor IfcDoorStandardCase IfcDoorStyle IfcDoorType IfcDuctFitting IfcDuctFittingType
      IfcDuctSegment IfcDuctSegmentType IfcDuctSilencer IfcDuctSilencerType IfcElectricAppliance
      IfcElectricApplianceType IfcElectricDistributionBoard IfcElectricDistributionBoardType
      IfcElectricFlowStorageDevice IfcElectricFlowStorageDeviceType IfcElectricGenerator IfcElectricGeneratorType
      IfcElectricMotor IfcElectricMotorType IfcElectricTimeControl IfcElectricTimeControlType IfcElement*
      IfcElementAssembly IfcElementAssemblyType IfcElementComponent* IfcElementComponentType* IfcElementType*
      IfcEnergyConversionDevice IfcEnergyConversionDeviceType* IfcEngine IfcEngineType IfcEvaporativeCooler
      IfcEvaporativeCoolerType IfcEvaporator IfcEvaporatorType IfcEvent IfcEventType IfcExternalSpatialElement
      IfcExternalSpatialStructureElement* IfcFan IfcFanType IfcFastener IfcFastenerType IfcFeatureElement*
      IfcFeatureElementAddition* IfcFeatureElementSubtraction* IfcFilter IfcFilterType IfcFireSuppressionTerminal
      IfcFireSuppressionTerminalType IfcFlowController IfcFlowControllerType* IfcFlowFitting IfcFlowFittingType*
      IfcFlowInstrument IfcFlowInstrumentType IfcFlowMeter IfcFlowMeterType IfcFlowMovingDevice
      IfcFlowMovingDeviceType* IfcFlowSegment IfcFlowSegmentType* IfcFlowStorageDevice IfcFlowStorageDeviceType*
      IfcFlowTerminal IfcFlowTerminalType* IfcFlowTreatmentDevice IfcFlowTreatmentDeviceType* IfcFooting
      IfcFootingType IfcFurnishingElement IfcFurnishingElementType IfcFurniture IfcFurnitureType
      IfcGeographicElement IfcGeographicElementType IfcGrid IfcGroup IfcHeatExchanger IfcHeatExchangerType
      IfcHumidifier IfcHumidifierType IfcInterceptor IfcInterceptorType IfcInventory IfcJunctionBox
      IfcJunctionBoxType IfcLaborResource IfcLaborResourceType IfcLamp IfcLampType IfcLightFixture
      IfcLightFixtureType IfcMechanicalFastener IfcMechanicalFastenerType IfcMedicalDevice IfcMedicalDeviceType
      IfcMember IfcMemberStandardCase IfcMemberType IfcMotorConnection IfcMotorConnectionType IfcObject*
      IfcObjectDefinition* IfcOccupant IfcOpeningElement IfcOpeningStandardCase IfcOutlet IfcOutletType
      IfcPerformanceHistory IfcPermit IfcPile IfcPileType IfcPipeFitting IfcPipeFittingType IfcPipeSegment
      IfcPipeSegmentType IfcPlate IfcPlateStandardCase IfcPlateType IfcPort* IfcProcedure IfcProcedureType
      IfcProcess* IfcProduct* IfcProject IfcProjectLibrary IfcProjectOrder IfcProjectionElement IfcProtectiveDevice
      IfcProtectiveDeviceTrippingUnit IfcProtectiveDeviceTrippingUnitType IfcProtectiveDeviceType IfcProxy IfcPump
      IfcPumpType IfcRailing IfcRailingType IfcRamp IfcRampFlight IfcRampFlightType IfcRampType IfcReinforcingBar
      IfcReinforcingBarType IfcReinforcingElement* IfcReinforcingElementType* IfcReinforcingMesh
      IfcReinforcingMeshType IfcResource* IfcRoof IfcRoofType IfcSanitaryTerminal IfcSanitaryTerminalType IfcSensor
      IfcSensorType IfcShadingDevice IfcShadingDeviceType IfcSite IfcSlab IfcSlabElementedCase IfcSlabStandardCase
      IfcSlabType IfcSolarDevice IfcSolarDeviceType IfcSpace IfcSpaceHeater IfcSpaceHeaterType IfcSpaceType
      IfcSpatialElement* IfcSpatialElementType* IfcSpatialStructureElement* IfcSpatialStructureElementType*
      IfcSpatialZone IfcSpatialZoneType IfcStackTerminal IfcStackTerminalType IfcStair IfcStairFlight
      IfcStairFlightType IfcStairType IfcStructuralAction* IfcStructuralActivity* IfcStructuralAnalysisModel
      IfcStructuralConnection* IfcStructuralCurveAction IfcStructuralCurveConnection IfcStructuralCurveMember
      IfcStructuralCurveMemberVarying IfcStructuralCurveReaction IfcStructuralItem* IfcStructuralLinearAction
      IfcStructuralLoadCase IfcStructuralLoadGroup IfcStructuralMember* IfcStructuralPlanarAction
      IfcStructuralPointAction IfcStructuralPointConnection IfcStructuralPointReaction IfcStructuralReaction*
      IfcStructuralResultGroup IfcStructuralSurfaceAction IfcStructuralSurfaceConnection IfcStructuralSurfaceMember
      IfcStructuralSurfaceMemberVarying IfcStructuralSurfaceReaction IfcSubContractResource
      IfcSubContractResourceType IfcSurfaceFeature IfcSwitchingDevice IfcSwitchingDeviceType IfcSystem
      IfcSystemFurnitureElement IfcSystemFurnitureElementType IfcTank IfcTankType IfcTask IfcTaskType IfcTendon
      IfcTendonAnchor IfcTendonAnchorType IfcTendonType IfcTransformer IfcTransformerType IfcTransportElement
      IfcTransportElementType IfcTubeBundle IfcTubeBundleType IfcTypeObject IfcTypeProcess* IfcTypeProduct
      IfcTypeResource* IfcUnitaryControlElement IfcUnitaryControlElementType IfcUnitaryEquipment
      IfcUnitaryEquipmentType IfcValve IfcValveType IfcVibrationIsolator IfcVibrationIsolatorType IfcVirtualElement
      IfcVoidingFeature IfcWall IfcWallElementedCase IfcWallStandardCase IfcWallType IfcWasteTerminal
      IfcWasteTerminalType IfcWindow IfcWindowStandardCase IfcWindowStyle IfcWindowType IfcWorkCalendar
      IfcWorkControl* IfcWorkPlan IfcWorkSchedule IfcZone
    `),
    makeVersion("IFC4X3", "IFC4.3", `
      IfcActionRequest IfcActor IfcActuator IfcActuatorType IfcAirTerminal IfcAirTerminalBox IfcAirTerminalBoxType
      IfcAirTerminalType IfcAirToAirHeatRecovery IfcAirToAirHeatRecoveryType IfcAlarm IfcAlarmType IfcAlignment
      IfcAlignmentCant IfcAlignmentHorizontal IfcAlignmentSegment IfcAlignmentVertical IfcAnnotation IfcAsset
      IfcAudioVisualAppliance IfcAudioVisualApplianceType IfcBeam IfcBeamType IfcBearing IfcBearingType IfcBoiler
      IfcBoilerType IfcBorehole IfcBridge IfcBridgePart IfcBuilding IfcBuildingElementPart
      IfcBuildingElementPartType IfcBuildingElementProxy IfcBuildingElementProxyType IfcBuildingStorey
      IfcBuildingSystem IfcBuiltElement IfcBuiltElementType IfcBuiltSystem IfcBurner IfcBurnerType
      IfcCableCarrierFitting IfcCableCarrierFittingType IfcCableCarrierSegment IfcCableCarrierSegmentType
      IfcCableFitting IfcCableFittingType IfcCableSegment IfcCableSegmentType IfcCaissonFoundation
      IfcCaissonFoundationType IfcChiller IfcChillerType IfcChimney IfcChimneyType IfcCivilElement
      IfcCivilElementType IfcCoil IfcCoilType IfcColumn IfcColumnType IfcCommunicationsAppliance
      IfcCommunicationsApplianceType IfcCompressor IfcCompressorType IfcCondenser IfcCondenserType
      IfcConstructionEquipmentResource IfcConstructionEquipmentResourceType IfcConstructionMaterialResource
      IfcConstructionMaterialResourceType IfcConstructionProductResource IfcConstructionProductResourceType
      IfcConstructionResource* IfcConstructionResourceType* IfcContext* IfcControl* IfcController IfcControllerType
      IfcConveyorSegment IfcConveyorSegmentType IfcCooledBeam IfcCooledBeamType IfcCoolingTower IfcCoolingTowerType
      IfcCostItem IfcCostSchedule IfcCourse IfcCourseType IfcCovering IfcCoveringType IfcCrewResource
      IfcCrewResourceType IfcCurtainWall IfcCurtainWallType IfcDamper IfcDamperType IfcDeepFoundation
      IfcDeepFoundationType IfcDiscreteAccessory IfcDiscreteAccessoryType IfcDistributionBoard
      IfcDistributionBoardType IfcDistributionChamberElement IfcDistributionChamberElementType
      IfcDistributionCircuit IfcDistributionControlElement IfcDistributionControlElementType* IfcDistributionElement
      IfcDistributionElementType IfcDistributionFlowElement IfcDistributionFlowElementType* IfcDistributionPort
      IfcDistributionSystem IfcDoor IfcDoorType IfcDuctFitting IfcDuctFittingType IfcDuctSegment IfcDuctSegmentType
      IfcDuctSilencer IfcDuctSilencerType IfcEarthworksCut IfcEarthworksElement IfcEarthworksFill
      IfcElectricAppliance IfcElectricApplianceType IfcElectricDistributionBoard IfcElectricDistributionBoardType
      IfcElectricFlowStorageDevice IfcElectricFlowStorageDeviceType IfcElectricFlowTreatmentDevice
      IfcElectricFlowTreatmentDeviceType IfcElectricGenerator IfcElectricGeneratorType IfcElectricMotor
      IfcElectricMotorType IfcElectricTimeControl IfcElectricTimeControlType IfcElement* IfcElementAssembly
      IfcElementAssemblyType IfcElementComponent* IfcElementComponentType* IfcElementType* IfcEnergyConversionDevice
      IfcEnergyConversionDeviceType* IfcEngine IfcEngineType IfcEvaporativeCooler IfcEvaporativeCoolerType
      IfcEvaporator IfcEvaporatorType IfcEvent IfcEventType IfcExternalSpatialElement
      IfcExternalSpatialStructureElement* IfcFacility IfcFacilityPart* IfcFacilityPartCommon IfcFan IfcFanType
      IfcFastener IfcFastenerType IfcFeatureElement* IfcFeatureElementAddition* IfcFeatureElementSubtraction*
      IfcFilter IfcFilterType IfcFireSuppressionTerminal IfcFireSuppressionTerminalType IfcFlowController
      IfcFlowControllerType* IfcFlowFitting IfcFlowFittingType* IfcFlowInstrument IfcFlowInstrumentType IfcFlowMeter
      IfcFlowMeterType IfcFlowMovingDevice IfcFlowMovingDeviceType* IfcFlowSegment IfcFlowSegmentType*
      IfcFlowStorageDevice IfcFlowStorageDeviceType* IfcFlowTerminal IfcFlowTerminalType* IfcFlowTreatmentDevice
      IfcFlowTreatmentDeviceType* IfcFooting IfcFootingType IfcFurnishingElement IfcFurnishingElementType
      IfcFurniture IfcFurnitureType IfcGeographicElement IfcGeographicElementType IfcGeomodel IfcGeoslice
      IfcGeotechnicalAssembly* IfcGeotechnicalElement* IfcGeotechnicalStratum IfcGrid IfcGroup IfcHeatExchanger
      IfcHeatExchangerType IfcHumidifier IfcHumidifierType IfcImpactProtectionDevice IfcImpactProtectionDeviceType
      IfcInterceptor IfcInterceptorType IfcInventory IfcJunctionBox IfcJunctionBoxType IfcKerb IfcKerbType
      IfcLaborResource IfcLaborResourceType IfcLamp IfcLampType IfcLightFixture IfcLightFixtureType IfcLinearElement
      IfcLinearPositioningElement IfcLiquidTerminal IfcLiquidTerminalType IfcMarineFacility IfcMarinePart
      IfcMechanicalFastener IfcMechanicalFastenerType IfcMedicalDevice IfcMedicalDeviceType IfcMember IfcMemberType
      IfcMobileTelecommunicationsAppliance IfcMobileTelecommunicationsApplianceType IfcMooringDevice
      IfcMooringDeviceType IfcMotorConnection IfcMotorConnectionType IfcNavigationElement IfcNavigationElementType
      IfcObject* IfcObjectDefinition* IfcOccupant IfcOpeningElement IfcOutlet IfcOutletType IfcPavement
      IfcPavementType IfcPerformanceHistory IfcPermit IfcPile IfcPileType IfcPipeFitting IfcPipeFittingType
      IfcPipeSegment IfcPipeSegmentType IfcPlate IfcPlateType IfcPort* IfcPositioningElement* IfcProcedure
      IfcProcedureType IfcProcess* IfcProduct* IfcProject IfcProjectLibrary IfcProjectOrder IfcProjectionElement
      IfcProtectiveDevice IfcProtectiveDeviceTrippingUnit IfcProtectiveDeviceTrippingUnitType
      IfcProtectiveDeviceType IfcPump IfcPumpType IfcRail IfcRailType IfcRailing IfcRailingType IfcRailway
      IfcRailwayPart IfcRamp IfcRampFlight IfcRampFlightType IfcRampType IfcReferent IfcReinforcedSoil
      IfcReinforcingBar IfcReinforcingBarType IfcReinforcingElement* IfcReinforcingElementType* IfcReinforcingMesh
      IfcReinforcingMeshType IfcResource* IfcRoad IfcRoadPart IfcRoof IfcRoofType IfcSanitaryTerminal
      IfcSanitaryTerminalType IfcSensor IfcSensorType IfcShadingDevice IfcShadingDeviceType IfcSign IfcSignType
      IfcSignal IfcSignalType IfcSite IfcSlab IfcSlabType IfcSolarDevice IfcSolarDeviceType IfcSpace IfcSpaceHeater
      IfcSpaceHeaterType IfcSpaceType IfcSpatialElement* IfcSpatialElementType* IfcSpatialStructureElement*
      IfcSpatialStructureElementType* IfcSpatialZone IfcSpatialZoneType IfcStackTerminal IfcStackTerminalType
      IfcStair IfcStairFlight IfcStairFlightType IfcStairType IfcStructuralAction* IfcStructuralActivity*
      IfcStructuralAnalysisModel IfcStructuralConnection* IfcStructuralCurveAction IfcStructuralCurveConnection
      IfcStructuralCurveMember IfcStructuralCurveMemberVarying IfcStructuralCurveReaction IfcStructuralItem*
      IfcStructuralLinearAction IfcStructuralLoadCase IfcStructuralLoadGroup IfcStructuralMember*
      IfcStructuralPlanarAction IfcStructuralPointAction IfcStructuralPointConnection IfcStructuralPointReaction
      IfcStructuralReaction* IfcStructuralResultGroup IfcStructuralSurfaceAction IfcStructuralSurfaceConnection
      IfcStructuralSurfaceMember IfcStructuralSurfaceMemberVarying IfcStructuralSurfaceReaction
      IfcSubContractResource IfcSubContractResourceType IfcSurfaceFeature IfcSwitchingDevice IfcSwitchingDeviceType
      IfcSystem IfcSystemFurnitureElement IfcSystemFurnitureElementType IfcTank IfcTankType IfcTask IfcTaskType
      IfcTendon IfcTendonAnchor IfcTendonAnchorType IfcTendonConduit IfcTendonConduitType IfcTendonType
      IfcTrackElement IfcTrackElementType IfcTransformer IfcTransformerType IfcTransportElement
      IfcTransportElementType IfcTransportationDevice* IfcTransportationDeviceType* IfcTubeBundle IfcTubeBundleType
      IfcTypeObject IfcTypeProcess* IfcTypeProduct IfcTypeResource* IfcUnitaryControlElement
      IfcUnitaryControlElementType IfcUnitaryEquipment IfcUnitaryEquipmentType IfcValve IfcValveType IfcVehicle
      IfcVehicleType IfcVibrationDamper IfcVibrationDamperType IfcVibrationIsolator IfcVibrationIsolatorType
      IfcVirtualElement IfcVoidingFeature IfcWall IfcWallStandardCase IfcWallType IfcWasteTerminal
      IfcWasteTerminalType IfcWindow IfcWindowType IfcWorkCalendar IfcWorkControl* IfcWorkPlan IfcWorkSchedule
      IfcZone
    `)
  ]);

  function search(version, query = "") {
    const source = versions.find(item => item.id === version);
    if (!source) return [];
    const terms = String(query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    return source.entities.filter(entity => terms.every(term => entity.code.toLowerCase().includes(term)));
  }

  return Object.freeze({ versions, search });
})();

