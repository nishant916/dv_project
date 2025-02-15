document.addEventListener("DOMContentLoaded", function () {
    // Enable Bootstrap tooltips globally
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipEl => {
        new bootstrap.Tooltip(tooltipEl, { html: true });
    });
});

const width = 960, height = 600;
const svg = d3.select("svg");
const legendSvg = d3.select("#legend"); // Select the legend SVG
const yearSlider = document.getElementById("yearSlider");
const selectedYearLabel = document.getElementById("selectedYear");

let stateDataByYear = new Map();
let babyNamesByYearAndState = new Map();
let stateAbbrToFips = new Map(); // Mapping of state abbreviation to FIPS code

d3.csv("birth_data.csv").then(data => {
    console.log("CSV Data Loaded:", data);

    // Aggregate stateBirths per year using STATEFP
    data.forEach(d => {
        let stateFIPS = d.State.padStart(2, '0'); // Ensure 2-digit FIPS
        let year = +d.Year;
        let births = +d.stateBirths;

        if (!stateDataByYear.has(year)) {
            stateDataByYear.set(year, new Map());
        }
        
        let yearData = stateDataByYear.get(year);

        if (!yearData.has(stateFIPS)) {
            yearData.set(stateFIPS, 0);
        }

        yearData.set(stateFIPS, yearData.get(stateFIPS) + births);
    });

    console.log("Aggregated Birth Data by Year:", stateDataByYear);

    // Calculate global min and max births across all years
    let globalMinBirths = Infinity;
    let globalMaxBirths = -Infinity;

    stateDataByYear.forEach(yearData => {
        const yearMin = d3.min(Array.from(yearData.values()));
        const yearMax = d3.max(Array.from(yearData.values()));

        if (yearMin < globalMinBirths) globalMinBirths = yearMin;
        if (yearMax > globalMaxBirths) globalMaxBirths = yearMax;
    });

    console.log("Global Min Births:", globalMinBirths);
    console.log("Global Max Births:", globalMaxBirths);

    // Load baby names data
    d3.csv("baby_names.csv").then(nameData => {
        console.log("Baby Names Data Loaded:", nameData);

        // Load GeoJSON
        d3.json("states.geojson").then(geoData => {
            console.log("GeoJSON Data Loaded:", geoData);

            // Create a mapping from state abbreviation to FIPS code
            geoData.features.forEach(feature => {
                stateAbbrToFips.set(feature.properties.STUSPS, feature.properties.STATEFP);
            });

            console.log("State Abbreviation to FIPS Mapping:", stateAbbrToFips);

            // Aggregate top 3 baby names per state and year
            nameData.forEach(d => {
                let stateAbbr = d.State; // Use state abbreviation
                let year = +d.Year;
                let name = d.Name;
                let count = +d.Count;

                // Check if the state abbreviation is mapped to a valid FIPS code
                let stateFIPS = stateAbbrToFips.get(stateAbbr);
                if (!stateFIPS) {
                    console.warn(`No FIPS code found for state abbreviation: ${stateAbbr}`);
                    return; // Skip if no matching FIPS code
                }

                if (!babyNamesByYearAndState.has(year)) {
                    babyNamesByYearAndState.set(year, new Map());
                }

                let yearStateData = babyNamesByYearAndState.get(year);

                if (!yearStateData.has(stateFIPS)) {
                    yearStateData.set(stateFIPS, []);
                }

                yearStateData.get(stateFIPS).push({ name, count });
            });

            // Sort each state's baby names and keep the top 3
            babyNamesByYearAndState.forEach((yearStateData, year) => {
                yearStateData.forEach((names, stateFIPS) => {
                    names.sort((a, b) => b.count - a.count);
                    yearStateData.set(stateFIPS, names.slice(0, 3)); // Keep top 3
                });
            });

            console.log("Aggregated Baby Names Data by Year and State:", babyNamesByYearAndState);

            const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
            const path = d3.geoPath().projection(projection);

            // Add color scale for legend
            const legendWidth = 500, legendHeight = 20; // Adjust for horizontal layout
            const legend = legendSvg.selectAll(".legend").data([0]); // Append to the legend SVG
            const legendEnter = legend.enter().append("g")
                .attr("class", "legend")
                .attr("transform", `translate(50, 20)`); // Position it within the legend SVG

            // Define fixed color scale for all years
            const colorScale = d3.scaleLog()
                .domain([globalMinBirths, globalMaxBirths]) // Use global min and max
                .range(["#ffffcc", "#006837"]); // Use a valid color range

            // Create a gradient for the legend
            const gradientId = "legend-gradient";
            legendSvg.append("defs")
                .append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%") // Gradient starts at the left
                .attr("x2", "100%") // Gradient ends at the right
                .attr("y1", "0%")
                .attr("y2", "0%")
                .selectAll("stop")
                .data([
                    { offset: "0%", color: "#ffffcc" }, // Start color
                    { offset: "100%", color: "#006837" } // End color
                ])
                .enter().append("stop")
                .attr("offset", d => d.offset)
                .attr("stop-color", d => d.color);

            // Create a single rectangle with gradient fill
            legendEnter.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", legendWidth)
                .attr("height", legendHeight)
                .attr("fill", `url(#${gradientId})`); // Apply the gradient

            // Add "Low" and "High" labels
            legendEnter.append("text")
                .attr("x", 0) // Position "Low" at the left
                .attr("y", -5) // Position above the rectangle
                .style("text-anchor", "start")
                .style("font-size", "12px")
                .style("font-weight", "bold")
                .text("Low");

            legendEnter.append("text")
                .attr("x", legendWidth) // Position "High" at the right
                .attr("y", -5) // Position above the rectangle
                .style("text-anchor", "end")
                .style("font-size", "12px")
                .style("font-weight", "bold")
                .text("High");

            // Add a label for the legend
            legendEnter.append("text")
                .attr("x", legendWidth / 2)
                .attr("y", legendHeight + 20) // Position text below the rectangle
                .style("text-anchor", "middle")
                .style("font-size", "14px")
                .style("font-weight", "bold")
                .text("Birth Counts");

            function updateMap(selectedYear) {
                let yearData = stateDataByYear.get(selectedYear) || new Map();
                let namesData = babyNamesByYearAndState.get(selectedYear) || new Map();

                // Update states with fixed color scale
                svg.selectAll(".state")
                    .data(geoData.features)
                    .join("path")
                    .attr("class", "state")
                    .attr("d", path)
                    .transition().duration(500) // Smooth transition
                    .attr("fill", d => {
                        const stateFIPS = d.properties.STATEFP;
                        return yearData.has(stateFIPS) 
                            ? colorScale(yearData.get(stateFIPS)) // Apply fixed color scale
                            : "#ccc"; // Gray for missing data
                    });

                // Update tooltip on hover
                svg.selectAll(".state")
                    .on("mouseover", function (event, d) {
                        const stateFIPS = d.properties.STATEFP;
                        const format = d3.format(",.0f"); // Format for commas, no decimals
                        const births = yearData.has(stateFIPS) 
                            ? format(Math.round(yearData.get(stateFIPS) / 1000)) + "K"
                            : "No Data";

                        // Get top 3 baby names for the state
                        const topNames = namesData.has(stateFIPS) 
                            ? namesData.get(stateFIPS).map(n => `${n.name}: ${n.count}`).join("<br>") 
                            : "No Data";

                        // Create formatted tooltip content
                        const tooltipContent = `
                            <strong class="custom-state-name">${d.properties.NAME} (${d.properties.STUSPS})</strong><br>
                            #Births: ${births}<hr>
                            <strong>Top 3 Baby Names:</strong><br>
                            ${topNames}
                        `;

                        // Set Bootstrap tooltip attributes dynamically
                        d3.select(this)
                            .attr("data-bs-toggle", "tooltip")
                            .attr("data-bs-html", "true") // Enable HTML rendering
                            .attr("title", tooltipContent); // Use 'title' attribute for tooltip content

                        // Manually trigger Bootstrap tooltip
                        const tooltipInstance = new bootstrap.Tooltip(this, { html: true });
                        tooltipInstance.show();
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
            yearSlider.addEventListener("input", function() {
                const selectedYear = +this.value;
                selectedYearLabel.textContent = selectedYear;
                updateMap(selectedYear);
            });
        });
    });
});