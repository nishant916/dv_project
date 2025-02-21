document.addEventListener("DOMContentLoaded", function () {
    initializeTooltips();
    initializeDropdown();
    loadData();
});

const width = 960, height = 600;
const svg = d3.select("svg");
const legendSvg = d3.select("#legend");
const seasonDropdown = document.getElementById("seasonDropdown");

let stateDataBySeason = new Map();
let totalBirthsByState = new Map();

// Percentage of births in a season fall within this range
const globalMinPercentage = 22, globalMaxPercentage = 27;

// Define season ranges: Spring (Mar to May), Summer (Jun to Aug), Autumn (Sep to Nov), Winter (Dec to Feb)
const seasons = { Spring: [3, 4, 5], Summer: [6, 7, 8], Autumn: [9, 10, 11], Winter: [12, 1, 2] };

// Initializing Bootstrap Tooltips
function initializeTooltips() {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(tooltipEl => {
        new bootstrap.Tooltip(tooltipEl, { html: true });
    });
}

// Event listener for season dropdown
function initializeDropdown() {
    seasonDropdown.addEventListener("change", function () {
        document.body.className = this.value.toLowerCase();
    });
}

// Loading Birth Data CSV and GeoJSON files using Promise.all (concurrent loading)
function loadData() {
    Promise.all([
        d3.csv("../data/birth_data.csv"),
        d3.json("../data/states.geojson")
    ]).then(([csvData, geoData]) => {
        processBirthData(csvData);
        initializeVisualization(geoData);
    });
}

// Aggregating births per season for each state
function processBirthData(data) {
    data.forEach(d => {
        const stateFIPS = d.State.padStart(2, '0');
        const month = +d.Month;
        const births = +d.stateBirths;
        
        // Determine the season for the current month
        let season = Object.keys(seasons).find(s => seasons[s].includes(month));
        
        // Initialize & aggregate stateDataBySeason for the decade
        if (!stateDataBySeason.has(season)) {
            stateDataBySeason.set(season, new Map());
        }
        let seasonData = stateDataBySeason.get(season);
        seasonData.set(stateFIPS, (seasonData.get(stateFIPS) || 0) + births);
        
        // Aggregate totalBirthsByState for the decade
        totalBirthsByState.set(stateFIPS, (totalBirthsByState.get(stateFIPS) || 0) + births);
    });
}

// Initializing the visualization
function initializeVisualization(geoData) {
    const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
    const path = d3.geoPath().projection(projection);
    
    // Using a sequential color scale: interpolateReds
    const colorScale = d3.scaleSequential(d3.interpolateReds).domain([globalMinPercentage, globalMaxPercentage]);
    
    setupLegend();
    updateMap("Spring", geoData, path, colorScale);
    seasonDropdown.addEventListener("change", function () {
        updateMap(this.value, geoData, path, colorScale);
    });
}

function setupLegend() {
    const legendWidth = 660, legendHeight = 20;
    const gradientId = "legend-gradient";
    legendSvg.append("defs")
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%")
        .selectAll("stop")
        .data([{ offset: "0%", color: "#fff5f0" }, { offset: "100%", color: "#cb181d" }]) // defining start & end color
        .enter().append("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color);
    
    legendSvg.append("rect").attr("x", 0).attr("y", 20).attr("width", legendWidth).attr("height", legendHeight).attr("fill", `url(#${gradientId})`);
    legendSvg.append("text").attr("x", 0).attr("y", 15).style("text-anchor","start").style("font-size","14px").style("font-weight","bold").text(`${globalMinPercentage}%`);
    legendSvg.append("text").attr("x", legendWidth).attr("y", 15).style("text-anchor","end").style("font-size","14px").style("font-weight","bold").text(`${globalMaxPercentage}%`);
    legendSvg.append("text").attr("x", legendWidth/2).attr("y", legendHeight + 40).style("text-anchor","middle").style("font-size","16px").style("font-weight","bold").text("Percentage of Births in a season");
}

// Update map & toolip when a season is selected
function updateMap(selectedSeason, geoData, path, colorScale) {
    const seasonData = stateDataBySeason.get(selectedSeason) || new Map();
    svg.selectAll(".state")
        .data(geoData.features)
        .join("path")
        .attr("class", "state")
        .attr("d", path)
        .attr("fill", d => {
            const stateFIPS = d.properties.STATEFP;
            const birthsForSeason = seasonData.get(stateFIPS) || 0;
            const totalBirthsForState = totalBirthsByState.get(stateFIPS) || 0;
            const percentage = totalBirthsForState > 0 ? (birthsForSeason / totalBirthsForState) * 100 : 0;
            return colorScale(percentage);
        })
        .on("mouseover", function (event, d) {
            showTooltip(event, d, selectedSeason, seasonData);
        })
        .on("mouseout", function () {
            hideTooltip(this);
        });
}

function showTooltip(event, d, selectedSeason, seasonData) {
    const stateFIPS = d.properties.STATEFP;
    const birthsForSeason = seasonData.get(stateFIPS) || 0;
    const avgBirthsForSeason = d3.format(",.0f")(birthsForSeason / 10000) + "K"; // Dividing by 10000 = (1000 for K) * (10 years)
    const totalBirthsForState = totalBirthsByState.get(stateFIPS) || 0;
    const percentage = totalBirthsForState > 0 ? ((birthsForSeason / totalBirthsForState) * 100).toFixed(2) : "0.00";
    
    const tooltipContent = `
        <strong class="custom-state-name">${d.properties.NAME}</strong><br>
        Avg births in ${selectedSeason}: ${avgBirthsForSeason.toLocaleString()}<br>
        Percentage: ${percentage}%
    `;
    
    d3.select(event.currentTarget)
        .attr("data-bs-toggle", "tooltip")
        .attr("data-bs-html", "true")
        .attr("title", tooltipContent);
    
    new bootstrap.Tooltip(event.currentTarget, { html: true }).show();
}

function hideTooltip(element) {
    const tooltipInstance = bootstrap.Tooltip.getInstance(element);
    if (tooltipInstance) tooltipInstance.dispose();
}
