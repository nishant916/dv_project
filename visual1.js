const width = 960, height = 600;
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");
const stateDropdown = d3.select("#stateDropdown");

let babyNamesDataByState = new Map(); // Map to hold data per state
let geoJSONData; // To hold geoJSON data

// Load geoJSON data
d3.json("states.geojson").then(data => {
    geoJSONData = data;
    console.log("GeoJSON Data Loaded:", geoJSONData);

    // Load baby names data
    d3.csv("baby_names.csv").then(data => {
        console.log("Baby Names Data Loaded:", data);

        // Prepare data: Group baby names by state and year
        data.forEach(d => {
            let stateAbbr = d.State; // Use state abbreviation
            let year = +d.Year;
            let name = d.Name;
            let count = +d.Count;
            let sex = d.Sex; // Add gender to the data

            if (!babyNamesDataByState.has(stateAbbr)) {
                babyNamesDataByState.set(stateAbbr, []);
            }

            babyNamesDataByState.get(stateAbbr).push({ year, name, count, sex });
        });

        // Prepare the list of states with full names and abbreviations
        const stateList = Array.from(babyNamesDataByState.keys()).map(abbr => {
            const stateFullName = getStateFullName(abbr); // Function to get the full state name
            return { abbr, fullName: stateFullName };
        });

        // Populate state dropdown (select)
        const dropdownOptions = d3.select("#stateDropdown").selectAll("option")
            .data(stateList)
            .enter()
            .append("option")
            .attr("value", d => d.abbr) // Use the state abbreviation as the value
            .text(d => `${d.fullName} (${d.abbr})`); // Display format: "Louisiana (LA)"

        // Disable gender selection initially
        document.querySelectorAll('input[name="gender"]').forEach(radio => {
            radio.disabled = true;
        });

        // Event listener for state selection change
        stateDropdown.on("change", function() {
            const selectedState = this.value;
            console.log("sleceted state", selectedState);
            if (selectedState) {
                // Enable gender selection
                document.querySelectorAll('input[name="gender"]').forEach(radio => {
                    radio.disabled = false;
                });

                // Set default gender to Male
                document.querySelector('#maleRadio').checked = true;

                // Render the chart
                const selectedGender = document.querySelector('input[name="gender"]:checked').value;
                renderLineChart(selectedState, selectedGender);
            } else {
                // Disable gender selection and clear the chart
                document.querySelectorAll('input[name="gender"]').forEach(radio => {
                    radio.disabled = true;
                });
                svg.selectAll("*").remove(); // Clear the chart
            }
        });

        document.querySelectorAll('input[name="gender"]').forEach(radio => {
            radio.addEventListener("change", function() {
                const selectedState = stateDropdown.node().value;
                if (selectedState) {
                    const selectedGender = this.value;
                    renderLineChart(selectedState, selectedGender);
                }
            });
        });

    });
});

// Function to map state abbreviation to full state name using geoJSON data
function getStateFullName(abbr) {
    const state = geoJSONData.features.find(feature => feature.properties.STUSPS === abbr);
    return state ? state.properties.NAME : null;
}

// Function to initialize Bootstrap tooltips
function initializeTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

function renderLineChart(selectedState, selectedGender) {
    // Clear previous chart
    svg.selectAll("*").remove();

    const stateData = babyNamesDataByState.get(selectedState);
    console.log("statedata", stateData);
    const filteredByGender = stateData.filter(d => d.sex === selectedGender);

    // Step 1: Calculate the top 5 names for the selected state across the entire decade
    const nameCounts = d3.rollup(filteredByGender, 
        v => d3.sum(v, d => d.count), // Sum counts for each name across all years
        d => d.name // Group by name
    );
    
    const top5NamesWithCounts = Array.from(nameCounts.entries())
        .sort((a, b) => b[1] - a[1]) 
        .slice(0, 5); 

    console.log(`Top 5 Names in ${selectedState} (${selectedGender === "F" ? "Female" : "Male"}) (2006-2015):`);
    top5NamesWithCounts.forEach(([name, count]) => console.log(`${name}: ${count}`));

    const top5Names = top5NamesWithCounts.map(d => d[0]); // Extract just the names

    // Step 2: Filter data for the selected state and top 5 names
    const filteredData = stateData.filter(d => top5Names.includes(d.name));

    // Step 3: Group data by year and name, summing up counts for each name in each year
    const groupedData = d3.rollup(filteredData, 
        v => d3.sum(v, d => d.count), // Sum counts for each name in each year
        d => d.year, // Group by year
        d => d.name // Group by name
    );

    // Debug: Log the grouped data
    console.log("Grouped data by year and name:", groupedData);

    // Define scales
    const xScale = d3.scaleLinear()
        .domain([2006, 2015])  
        .range([50, width - 50]);

    const maxCount = d3.max(filteredData, d => d.count); // Find the maximum count
    const yScale = d3.scaleLinear()
        .domain([0, maxCount * 1.2]) 
        .range([height - 50, 50]);


    // Add x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height - 50})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))

    // Add y-axis
    svg.append("g")
        .attr("transform", `translate(50, 0)`)
        .call(d3.axisLeft(yScale)
        .tickSizeOuter(0) 
    );

    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .text(`Top 5 Baby Names in ${getStateFullName(selectedState)} (${selectedGender === "F" ? "Female" : "Male"}) (2006-2015)`);


    // **Added Axis Labels**
     svg.append("text")
     .attr("x", width / 2)
     .attr("y", height - 10)
     .attr("text-anchor", "middle")
     .style("font-size", "14px")
     .text("Year");

    svg.append("text")
     .attr("transform", "rotate(-90)")
     .attr("y", 10)
     .attr("x", -height / 2)
     .attr("text-anchor", "middle")
     .style("font-size", "14px")
     .text("Count of Baby Names");


    // Draw lines
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    top5Names.forEach(name => {
        const lineData = Array.from({ length: 10 }, (_, i) => 2006 + i).map(year => {
            const count = groupedData.get(year)?.get(name) || 0; // Get count for the name in the year, or 0 if not found
            return { year, count, name }; // Include the name in the data for tooltips
        });
        // Debug: Log line data
        console.log(`Line data for ${name}:`, lineData);
        
        svg.append("path")
            .datum(lineData)
            .attr("fill", "none")
            .attr("stroke", colorScale(name))
            .attr("stroke-width", 2)
            .attr("d", d3.line().x(d => xScale(d.year)).y(d => yScale(d.count)));

        // Add circles for each data point
        svg.selectAll(`.dot-${name}`)
            .data(lineData)
            .enter().append("circle")
            .attr("class", `dot-${name}`)
            .attr("cx", d => xScale(d.year))
            .attr("cy", d => yScale(d.count))
            .attr("r", 5)
            .style("fill", colorScale(name))
            .on("mouseover", function(event, d) {
                tooltip.style("display", "block")
                    .html(`<strong>${d.name}:</strong> ${d.count}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 30) + "px")
                    .style("background-color", colorScale(name))  
                    .style("color", "white")               
                    .style("border", `2px solid ${colorScale(name)}`); 
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 30) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("display", "none");
            });
    });

    // Initialize Bootstrap tooltips
    initializeTooltips();

    // **Moved Legend to Avoid Interference**
    const legend = svg.selectAll(".legend")
        .data(top5Names)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => `translate(${width - 100},${10 + i * 25})`);

    legend.append("rect")
        .attr("x", 0)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", colorScale);

    legend.append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .text(d => d);
}