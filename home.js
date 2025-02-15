const width = 960, height = 600;
const svg = d3.select("svg");
const tooltip = d3.select(".tooltip");
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

            function updateMap(selectedYear) {
                let yearData = stateDataByYear.get(selectedYear) || new Map();
                let namesData = babyNamesByYearAndState.get(selectedYear) || new Map();

                // Define color scale
                const birthValues = Array.from(yearData.values());
                const colorScale = d3.scaleQuantile()
                    .domain(birthValues)
                    .range(d3.schemeRdYlGn[9]); // 9 color buckets

                // Update states
                svg.selectAll(".state")
                    .data(geoData.features)
                    .join("path")
                    .attr("class", "state")
                    .attr("d", path)
                    .transition().duration(500) // Smooth transition
                    .attr("fill", d => {
                        const stateFIPS = d.properties.STATEFP;
                        return yearData.has(stateFIPS) 
                            ? colorScale(yearData.get(stateFIPS)) 
                            : "#ccc"; // Gray for missing data
                    });

                // Update tooltip on hover
                svg.selectAll(".state")
                    .on("mouseover", (event, d) => {
                        const stateFIPS = d.properties.STATEFP;
                        const format = d3.format(",.0f"); // Format for commas, no decimals
                        const births = yearData.has(stateFIPS) 
                            ? format(Math.round(yearData.get(stateFIPS) / 1000)) + "K"
                            : "No Data";

                        // Get top 3 baby names for the state
                        const topNames = namesData.has(stateFIPS) 
                            ? namesData.get(stateFIPS).map(n => `${n.name}: ${n.count}`).join("<br>") 
                            : "No Data";

                        tooltip.style("display", "block")
                            .html(`<strong>${d.properties.NAME} (${d.properties.STUSPS})</strong><br>#Births: ${births}<br><strong>Top 3 Baby Names:</strong><br>${topNames}`)
                            .style("left", `${event.pageX + 10}px`)
                            .style("top", `${event.pageY + 10}px`);
                    })
                    .on("mouseout", () => tooltip.style("display", "none"));
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