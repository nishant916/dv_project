document.addEventListener("DOMContentLoaded", initializeTooltips);

// Global Variables
const width = 960, height = 600;
const svg = d3.select("svg");
const legendSvg = d3.select("#legend");
const yearSlider = document.getElementById("yearSlider");
const selectedYearLabel = document.getElementById("selectedYear");

let stateDataByYear = new Map();
let babyNamesByYearAndState = new Map();
let stateAbbrToFips = new Map();
let globalMinBirths = Infinity;
let globalMaxBirths = -Infinity;

// Initialize Bootstrap Tooltips
function initializeTooltips() {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(tooltipEl => {
        new bootstrap.Tooltip(tooltipEl, { html: true });
    });
}

// Load the CSV files and GeoJSON file before processing the data
async function loadData() {
    try {
        const birthData = await d3.csv("../data/birth_data.csv");
        const nameData = await d3.csv("../data/baby_names.csv");
        const geoData = await d3.json("../data/states.geojson");

        processBirthData(birthData);
        processNameData(nameData, geoData);
        createLegend();
        initializeMap(geoData);
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// Aggregate stateBirths per year using STATEFIPS
function processBirthData(data) {
    data.forEach(d => {
        let stateFIPS = d.State.padStart(2, '0'); // Ensure 2-digit stateFIPS (dataset has 1 or 2 digits)
        let year = +d.Year;
        let births = +d.stateBirths;

        if (!stateDataByYear.has(year)) {
            stateDataByYear.set(year, new Map());
        }
        let yearData = stateDataByYear.get(year);

        yearData.set(stateFIPS, (yearData.get(stateFIPS) || 0) + births);
    });

    // Calculate global min and max births across all years
    stateDataByYear.forEach(yearData => {
        const yearMin = d3.min(Array.from(yearData.values()));
        const yearMax = d3.max(Array.from(yearData.values()));

        if (yearMin < globalMinBirths) globalMinBirths = yearMin;
        if (yearMax > globalMaxBirths) globalMaxBirths = yearMax;
    });
}

// Aggregate top 3 baby names by state and year
function processNameData(data, geoData) {
    // Create a mapping from state abbreviation to FIPS code
    geoData.features.forEach(feature => {
        stateAbbrToFips.set(feature.properties.STUSPS, feature.properties.STATEFP);
    });

    data.forEach(d => {
        let stateFIPS = stateAbbrToFips.get(d.State);
        if (!stateFIPS) return;

        let year = +d.Year;
        let name = d.Name;
        let count = +d.Count;

        if (!babyNamesByYearAndState.has(year)) {
            babyNamesByYearAndState.set(year, new Map());
        }
        let yearStateData = babyNamesByYearAndState.get(year);

        if (!yearStateData.has(stateFIPS)) {
            yearStateData.set(stateFIPS, []);
        }
        yearStateData.get(stateFIPS).push({ name, count });
    });

    babyNamesByYearAndState.forEach(yearStateData => {
        yearStateData.forEach((names, stateFIPS) => {
            names.sort((a, b) => b.count - a.count);
            yearStateData.set(stateFIPS, names.slice(0, 3));
        });
    });
}

// Defining the legend
function createLegend() {
    const legendWidth = 660, legendHeight = 20;
    const gradientId = "legend-gradient";

    legendSvg.append("defs")
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%")
        .selectAll("stop")
        .data([
            { offset: "0%", color: "#ffffcc" }, // start color
            { offset: "100%", color: "#006837" } // end color
        ])
        .enter().append("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color);

    // Position it within the legend SVG
    const legend = legendSvg.append("g").attr("class", "legend").attr("transform", "translate(0, 20)");
    
    // Create a single rectangle with gradient fill
    legend.append("rect").attr("width", legendWidth).attr("height", legendHeight).attr("fill", `url(#${gradientId})`);
    legend.append("text").attr("x", 0).attr("y", -5).style("text-anchor","start").style("font-size","14px").style("font-weight","bold").text("Low");
    legend.append("text").attr("x", legendWidth).attr("y", -5).style("text-anchor","end").style("font-size","14px").style("font-weight","bold").text("High");
    legend.append("text").attr("x", legendWidth / 2).attr("y", legendHeight + 20).style("text-anchor","middle").style("font-size","16px").style("font-weight","bold").text("Birth Counts");
}

//
function initializeMap(geoData) {
    const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
    const path = d3.geoPath().projection(projection);
    
    // Defining a logrithmic color scale for the map globalMinBirths & globalMaxBirths
    const colorScale = d3.scaleLog().domain([globalMinBirths, globalMaxBirths]).range(["#ffffcc", "#006837"]);

    function updateMap(selectedYear) {
        let yearData = stateDataByYear.get(selectedYear) || new Map();
        let namesData = babyNamesByYearAndState.get(selectedYear) || new Map();

        svg.selectAll(".state")
            .data(geoData.features)
            .join("path")
            .attr("class", "state")
            .attr("d", path)
            .transition().duration(500)
            .attr("fill", d => {
                const stateFIPS = d.properties.STATEFP;
                return yearData.has(stateFIPS) ? colorScale(yearData.get(stateFIPS)) : "#ccc"; // Gray for missing data
            });
        
        // Update tooltip on hover
        svg.selectAll(".state")
            .on("mouseover", function (event, d) {
                const stateFIPS = d.properties.STATEFP;
                const format = d3.format(",.0f");
                const births = yearData.has(stateFIPS) ? format(Math.round(yearData.get(stateFIPS) / 1000)) + "K" : "No Data";
                const topNames = namesData.has(stateFIPS) ? namesData.get(stateFIPS).map(n => `${n.name}: ${n.count}`).join("<br>") : "No Data";
                const tooltipContent = `<strong class="custom-state-name">${d.properties.NAME} (${d.properties.STUSPS})</strong><br>#Births: ${births}<hr><strong>Top 3 Baby Names:</strong><br>${topNames}`;
                
                // Set Bootstrap tooltip attributes dynamically
                d3.select(this).attr("data-bs-toggle", "tooltip").attr("data-bs-html", "true").attr("title", tooltipContent);
                
                // Manually trigger Bootstrap tooltip
                new bootstrap.Tooltip(this, { html: true }).show();
            })
            .on("mouseout", function () {
                // Hide and destroy tooltip on mouseout
                const tooltipInstance = bootstrap.Tooltip.getInstance(this);
                if (tooltipInstance) tooltipInstance.dispose();
            });
    }

    // Initialize map with default year (2006)
    updateMap(2006);

    // Update map when slider changes
    yearSlider.addEventListener("input", function () {
        selectedYearLabel.textContent = this.value;
        updateMap(+this.value);
    });
}

loadData();
