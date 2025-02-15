const width = 960, height = 600;
const svg = d3.select("svg");
const tooltip = d3.select(".tooltip");

d3.csv("birth_data.csv").then(data => {
    console.log("CSV Data Loaded:", data);

    let stateDataByYear = new Map();

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

    // Load GeoJSON and visualize the first available year (e.g., 2006)
    d3.json("states.geojson").then(geoData => {
        console.log("GeoJSON Data Loaded:", geoData);

        const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
        const path = d3.geoPath().projection(projection);

        let selectedYear = 2006; // Default year
        let yearData = stateDataByYear.get(selectedYear) || new Map();

        // Set domain using actual state birth values
        const birthValues = Array.from(yearData.values());
        const colorScale = d3.scaleQuantile()
            .domain(birthValues) // Use all state birth counts for the selected year
            .range(d3.schemeRdYlGn[9]); // Uses 15 color shades from D3

        svg.selectAll(".state")
            .data(geoData.features)
            .join("path")
            .attr("class", "state")
            .attr("d", path)
            .attr("fill", d => {
                const stateFIPS = d.properties.STATEFP;
                return yearData.has(stateFIPS) 
                    ? colorScale(yearData.get(stateFIPS)) 
                    : "#ccc"; // Gray for missing data
            })            
            .on("mouseover", (event, d) => {
                const stateFIPS = d.properties.STATEFP;
                const format = d3.format(",.0f"); // Format for commas with no decimals
                const births = yearData.has(stateFIPS) 
                    ? format(Math.round(yearData.get(stateFIPS) / 1000)) + "K" // Show in thousands
                    : "No Data";
                
                tooltip.style("display", "block")
                    .html(`<strong>${d.properties.NAME} (${d.properties.STUSPS})</strong><br>#Births: ${births}`)
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY + 10}px`);
            })
            .on("mouseout", () => tooltip.style("display", "none"));
    });
});
