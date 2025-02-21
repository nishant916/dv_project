document.addEventListener("DOMContentLoaded", initializeTooltips);

const width = 960, height = 600;
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");
const stateDropdown = d3.select("#stateDropdown");

let babyNamesDataByState = new Map();
let geoJSONData;

// Load all data
function loadData() {
    Promise.all([
        d3.csv("../data/baby_names.csv"),
        d3.json("../data/states.geojson") 

    ]).then(([nameData, geoData]) =>{
        geoJSONData = geoData;
        processBabyNamesData(nameData);
        populateStateDropdown();
        setupEventListeners();
    });
}

// Process baby names data
function processBabyNamesData(data) {
    data.forEach(d => {
        const stateAbbr = d.State;
        const year = +d.Year;
        const name = d.Name;
        const count = +d.Count;
        const sex = d.Sex;

        if (!babyNamesDataByState.has(stateAbbr)) {
            babyNamesDataByState.set(stateAbbr, []);
        }

        babyNamesDataByState.get(stateAbbr).push({ year, name, count, sex });
    });
}

// Populate state dropdown
function populateStateDropdown() {
    const stateList = Array.from(babyNamesDataByState.keys())
        .map(abbr => ({ abbr, fullName: getStateFullName(abbr) }))
        .sort((a, b) => d3.ascending(a.fullName, b.fullName));

    stateDropdown.selectAll("option")
        .data(stateList)
        .enter().append("option")
        .attr("value", d => d.abbr)
        .text(d => `${d.fullName} (${d.abbr})`);
}

// Get full state name from abbreviation using geoJSON
function getStateFullName(abbr) {
    const state = geoJSONData.features.find(feature => feature.properties.STUSPS === abbr);
    return state ? state.properties.NAME : null;
}

// Set up event listeners for dropdown and gender selection
function setupEventListeners() {
    document.querySelectorAll('input[name="gender"]').forEach(radio => radio.disabled = true);

    stateDropdown.on("change", handleStateChange);
    document.querySelectorAll('input[name="gender"]').forEach(radio => radio.addEventListener("change", handleGenderChange));
}

// Handle state selection change
function handleStateChange() {
    const selectedState = this.value;
    if (selectedState) {
        document.querySelectorAll('input[name="gender"]').forEach(radio => radio.disabled = false);
        document.querySelector('#maleRadio').checked = true;
        document.body.className = "boy";
        renderLineChart(selectedState, "M");
    } else {
        document.querySelectorAll('input[name="gender"]').forEach(radio => radio.disabled = true);
        svg.selectAll("*").remove(); // clear the chart
    }
}

// Handle gender selection change
function handleGenderChange() {
    const selectedState = stateDropdown.node().value;
    if (selectedState) {
        const selectedGender = this.value;
        document.body.className = selectedGender === 'F' ? "girl" : "boy";
        renderLineChart(selectedState, selectedGender);
    }
}

// Render the line chart
function renderLineChart(selectedState, selectedGender) {
    svg.selectAll("*").remove(); // clear the chart
    const stateData = babyNamesDataByState.get(selectedState).filter(d => d.sex === selectedGender);
    const top5Names = getTop5Names(stateData);

    const filteredData = stateData.filter(d => top5Names.includes(d.name));
    const groupedData = d3.rollup(filteredData, v => d3.sum(v, d => d.count), d => d.year, d => d.name);

    const xScale = d3.scaleLinear().domain([2006, 2015]).range([80, width - 50]);
    const yScale = d3.scaleLinear().domain([0, d3.max(filteredData, d => d.count) * 1.2]).range([height - 50, 50]);

    drawAxes(xScale, yScale);
    drawLines(top5Names, groupedData, xScale, yScale);
    drawLegend(top5Names);
}

// Get the top 5 baby names for a state
function getTop5Names(stateData) {
    const nameCounts = d3.rollup(stateData, v => d3.sum(v, d => d.count), d => d.name);
    return Array.from(nameCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(d => d[0]);
}

// Draw X and Y axes
function drawAxes(xScale, yScale) {
    svg.append("g").attr("transform", `translate(0,${height - 50})`).call(d3.axisBottom(xScale).tickFormat(d3.format("d"))).selectAll("text").style("font-size", "14px").style("font-weight", "bold");
    svg.append("g").attr("transform", `translate(80,0)`).call(d3.axisLeft(yScale).tickSizeOuter(0)).selectAll("text").style("font-size", "14px").style("font-weight", "bold");

    svg.append("text").attr("x", width / 2 + 15).attr("y", height).attr("text-anchor", "middle").style("font-size", "18px").style("font-weight", "bold").text("Year");
    svg.append("text").attr("transform", "rotate(-90)").attr("y", 25).attr("x", -height / 2).attr("text-anchor", "middle").style("font-size", "18px").style("font-weight", "bold").text("Count of Baby Names");
}

// Draw line chart
function drawLines(top5Names, groupedData, xScale, yScale) {
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    top5Names.forEach(name => {
        const lineData = Array.from({ length: 10 }, (_, i) => 2006 + i).map(year => ({
            year,
            count: groupedData.get(year)?.get(name) || 0,
            name
        }));

        svg.append("path").datum(lineData).attr("fill", "none").attr("stroke", colorScale(name)).attr("stroke-width", 2)
            .attr("d", d3.line().x(d => xScale(d.year)).y(d => yScale(d.count)));

        drawDataPoints(lineData, colorScale(name), xScale, yScale);
    });
}

// Draw data points on the line chart
function drawDataPoints(lineData, color, xScale, yScale) {
    svg.selectAll(`.dot-${lineData[0].name}`).data(lineData).enter().append("circle")
        .attr("class", d => `dot-${d.name}`)
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.count))
        .attr("r", 5)
        .style("fill", color)
        .on("mouseover", showTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);
}

// Show tooltip
function showTooltip(event, d) {
    const color = d3.select(event.target).style("fill"); // Get the color of the data point
    tooltip.style("display", "block").html(`<strong>${d.name}:</strong> ${d.count}`)
        .style("background-color", color);
    moveTooltip(event);
}

// Move tooltip
function moveTooltip(event) {
    tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 30) + "px");
}

// Hide tooltip
function hideTooltip() {
    tooltip.style("display", "none");
}

// Draw legend
function drawLegend(top5Names) {
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    const legend = svg.selectAll(".legend").data(top5Names).enter().append("g")
        .attr("class", "legend").attr("transform", (d, i) => `translate(${width - 100},${10 + i * 25})`);

    legend.append("rect").attr("width", 18).attr("height", 18).style("fill", colorScale);
    legend.append("text").attr("x", 24).attr("y", 9).attr("dy", ".35em").style("text-anchor", "start").text(d => d);
}

// Initialize Bootstrap tooltips
function initializeTooltips() {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
}

// Load data on start
loadData();
