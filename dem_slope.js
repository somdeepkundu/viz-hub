
/**
 * Earth Engine Script to visualize multiple DEMs and slope side-by-side.
 * Creates an interface with a dropdown using full dataset names.
 */
 
// Helper function to retrieve the elevation image and visualization for a given
// dataset id.
function getElevationDataset(demId) {
  var dataset;
  var bandName;
  var elevationVis;

  if (demId === 'SRTM90_V4') {
    dataset = ee.Image('CGIAR/SRTM90_V4');
    bandName = 'elevation';
    elevationVis = {
      min: 506,
      max: 553,
      palette: ['0000ff', '00ffff', 'ffff00', 'ff0000', 'ffffff'],
    };
  } else if (demId === 'GMTED2010_FULL') {
    dataset = ee.Image('USGS/GMTED2010_FULL');
    bandName = 'min';
    elevationVis = {
      min: 506,
      max: 553,
      palette: ['0000ff', '00ffff', 'ffff00', 'ff0000', 'ffffff'],
    };
  } else if (demId === 'AW3D30_V4_1') {
    dataset = ee.ImageCollection('JAXA/ALOS/AW3D30/V4_1').mosaic();
    bandName = 'DSM';
    elevationVis = {
      min: 506,
      max: 553,
      palette: ['0000ff', '00ffff', 'ffff00', 'ff0000', 'ffffff'],
    };
  } else {
    // Default to SRTM
    dataset = ee.Image('CGIAR/SRTM90_V4');
    bandName = 'elevation';
    elevationVis = {
      min: 506,
      max: 553,
      palette: ['0000ff', '00ffff', 'ffff00', 'ff0000', 'ffffff'],
    };
  }

  var elevation = dataset.select(bandName);
  return {
    elevation: elevation,
    elevationVis: elevationVis,
  };
}

// Generate a gradient legend panel for the map.
function createGradientLegend(vizParams, title) {
  var legendPanel = ui.Panel({
    style: {
      position: 'bottom-left',
      padding: '8px 15px'
    }
  });

  var legendTitle = ui.Label(title, {
    fontWeight: 'bold',
    fontSize: '16px',
    margin: '0 0 4px 0',
    padding: '0'
  });
  legendPanel.add(legendTitle);

  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: {
      bbox: [0, 0, 1, 0.1],
      dimensions: '100x10',
      format: 'png',
      min: 0,
      max: 1,
      palette: vizParams.palette,
    },
    style: {stretch: 'horizontal', margin: '0px 8px'}
  });
  legendPanel.add(colorBar);

  var minLabel = ui.Label(vizParams.min, {margin: '0 8px 0 0'});
  var maxLabel = ui.Label(vizParams.max, {margin: '0 0 0 8px'});
  var labelsPanel = ui.Panel([minLabel, maxLabel],
                             ui.Panel.Layout.Flow('horizontal'));
  legendPanel.add(labelsPanel);

  return legendPanel;
}

// Options for the DEM dropdown with human-readable names.
var demOptions = [
  {
    label: 'SRTM Digital Elevation Data Version 4 - 90m - 2000',
    value: 'SRTM90_V4'
  },
  {
    label: 'Global Multi-resolution Terrain Elevation Data - 200m - 2010',
    value: 'GMTED2010_FULL'
  },
  {
    label: 'ALOS World 3D - 30m DSM - 2006-11',
    value: 'AW3D30_V4_1'
  }
];

// Create the DEM selection dropdown.
var demSelect = ui.Select({
  items: demOptions,
  value: demOptions[0].value,
  onChange: function(value) {
    updateMaps(value);
  },
  style: {position: 'top-left'}
});

// Titles for left and right maps.
var leftTitle = ui.Label({
  value: 'Elevation',
  style: {fontWeight: 'bold', fontSize: '18px', position: 'top-right'}
});

var rightTitle = ui.Label({
  value: 'Slope',
  style: {fontWeight: 'bold', fontSize: '18px', position: 'top-left'}
});

var leftMap = ui.Map();
var rightMap = ui.Map();
leftMap.add(leftTitle);
rightMap.add(rightTitle);

var linker = ui.Map.Linker([leftMap, rightMap]);

var splitPanel = ui.SplitPanel({
  firstPanel: leftMap,
  secondPanel: rightMap,
  orientation: 'horizontal',
  wipe: false,
});

ui.root.widgets().reset([splitPanel]);

// Main update function to refresh the maps when a new DEM is chosen.
function updateMaps(demId) {
  var demData = getElevationDataset(demId);
  var elevation = demData.elevation;
  var elevationViz = demData.elevationVis;

  // Compute slope. Use a different approach for the ALOS DSM so that the
  // terrain algorithm runs in the native projection.
  var slope;
  if (demId === 'AW3D30_V4_1') {
    // Get the projection from the first image in the collection rather than
    // using the projection of the mosaic.
    var alosCollection = ee.ImageCollection('JAXA/ALOS/AW3D30/V4_1');
    var nativeProj = alosCollection.first().select('DSM').projection();
    slope = ee.Terrain.slope(elevation.setDefaultProjection(nativeProj));
  } else {
    slope = ee.Terrain.slope(elevation);
  }

  var slopeViz = {
    min: -1,
    max: 5,
    palette: ['c2e699', 'a6d96a', '66a61e', '4d7b16', '238b45', '005a32']
  };

  if (leftMap && leftMap.layers) {
    leftMap.layers().reset();
  }
  if (rightMap && rightMap.layers) {
    rightMap.layers().reset();
  }

  leftMap.addLayer(elevation.clip(table), elevationViz, demId + ' Elevation');
  rightMap.addLayer(slope.clip(table), slopeViz, demId + ' Slope');

  leftTitle.setValue(demId + ' Elevation');
  rightTitle.setValue(demId + ' Slope');

  if (leftMap && leftMap.widgets) {
    leftMap.widgets().forEach(function(widget) {
      if (widget.style().get('position') === 'bottom-left') {
        leftMap.remove(widget);
      }
    });
  }
  if (rightMap && rightMap.widgets) {
    rightMap.widgets().forEach(function(widget) {
      if (widget.style().get('position') === 'bottom-left') {
        rightMap.remove(widget);
      }
    });
  }

  if (leftMap) {
    leftMap.add(createGradientLegend(elevationViz, demId + ' Elevation'));
  }
  if (rightMap) {
    rightMap.add(createGradientLegend(slopeViz, demId + ' Slope'));
  }
}

// Center maps on the region of interest 'table' and add the dropdown.
leftMap.centerObject(table, 13);
rightMap.centerObject(table, 13);
leftMap.add(demSelect);

// Initial map update.
updateMaps(demOptions[0].value);

// Somdeep Kundu, RuDRA Lab, CTARA, IIT Bombay
// 28-06-2025

