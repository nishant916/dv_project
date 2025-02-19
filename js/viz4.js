document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("seasonDropdown").addEventListener("change", function () {
        const selectedSeason = this.value.toLowerCase(); // Get the selected season
        document.body.className = selectedSeason; // Apply the corresponding class
    });
    
    // Enable Bootstrap tooltips globally
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipEl => {
        new bootstrap.Tooltip(tooltipEl, { html: true });
    });

    const width = 960, height = 600;
    const svg = d3.select("svg");
    const legendSvg = d3.select("#legend"); // Select the legend SVG
    const seasonDropdown = document.getElementById("seasonDropdown");

    let stateDataBySeason = new Map(); // Store aggregated births by state and season
    let totalBirthsByState = new Map(); // Store total births by state across all seasons

    // Hard-coded percentage range
    const globalMinPercentage = 22; // Minimum percentage
    const globalMaxPercentage = 27; // Maximum percentage

    d3.csv("../data/birth_data.csv").then(data => {
        console.log("CSV Data Loaded:", data);

        // Define season ranges
        const seasons = {
            Spring: [3, 4, 5], // March, April, May
            Summer: [6, 7, 8], // June, July, August
            Autumn: [9, 10, 11], // September, October, November
            Winter: [12, 1, 2] // December, January, February
        };

        // Aggregate births by state and season
        data.forEach(d => {
            const stateFIPS = d.State.padStart(2, '0'); // Ensure 2-digit FIPS
            const month = +d.Month; // Month is provided as 1, 2, 3, ..., 12
            const births = +d.stateBirths;

            // Determine the season for the current month
            let season;
            for (const [key, months] of Object.entries(seasons)) {
                if (months.includes(month)) {
                    season = key;
                    break;
                }
            }

            // Initialize stateDataBySeason
            if (!stateDataBySeason.has(season)) {
                stateDataBySeason.set(season, new Map());
            }
            const seasonData = stateDataBySeason.get(season);
            if (!seasonData.has(stateFIPS)) {
                seasonData.set(stateFIPS, 0);
            }
            seasonData.set(stateFIPS, seasonData.get(stateFIPS) + births);

            // Initialize totalBirthsByState
            if (!totalBirthsByState.has(stateFIPS)) {
                totalBirthsByState.set(stateFIPS, 0);
            }
            totalBirthsByState.set(stateFIPS, totalBirthsByState.get(stateFIPS) + births);
        });

        console.log("Aggregated Birth Data by Season and State:", stateDataBySeason);
        console.log("Total Births by State:", totalBirthsByState);

        // Load GeoJSON
        d3.json("../data/states.geojson").then(geoData => {
            console.log("GeoJSON Data Loaded:", geoData);

            const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
            const path = d3.geoPath().projection(projection);

            // Define fixed sequential color scale
            const colorScale = d3.scaleSequential(d3.interpolateReds)
                .domain([globalMinPercentage, globalMaxPercentage]);

            // Create gradient for legend
            const gradientId = "legend-gradient";
            legendSvg.append("defs")
                .append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("x2", "100%")
                .attr("y1", "0%")
                .attr("y2", "0%")
                .selectAll("stop")
                .data([
                    { offset: "0%", color: "#fff5f0" }, // Start color
                    { offset: "100%", color: "#cb181d" } // End color
                ])
                .enter().append("stop")
                .attr("offset", d => d.offset)
                .attr("stop-color", d => d.color);

            // Add legend
            legendSvg.append("rect")
                .attr("x", 50)
                .attr("y", 20)
                .attr("width", 500)
                .attr("height", 20)
                .attr("fill", `url(#${gradientId})`);

            legendSvg.append("text")
                .attr("x", 50)
                .attr("y", 15)
                .style("text-anchor", "start")
                .style("font-size", "12px")
                .style("font-weight", "bold")
                .text(`${globalMinPercentage}%`);

            legendSvg.append("text")
                .attr("x", 550)
                .attr("y", 15)
                .style("text-anchor", "end")
                .style("font-size", "12px")
                .style("font-weight", "bold")
                .text(`${globalMaxPercentage}%`);

            legendSvg.append("text")
                .attr("x", 300)
                .attr("y", 60)
                .style("text-anchor", "middle")
                .style("font-size", "14px")
                .style("font-weight", "bold")
                .text("Percentage of Births");

            // Function to update the map based on the selected season
            function updateMap(selectedSeason) {
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
                        const percentage = totalBirthsForState > 0 
                            ? (birthsForSeason / totalBirthsForState) * 100 
                            : 0; // Avoid division by zero
                        return colorScale(percentage);
                    })
                    .on("mouseover", function (event, d) {
                        const stateFIPS = d.properties.STATEFP;
                        const birthsForSeason = seasonData.get(stateFIPS) || 0;
                        const format = d3.format(",.0f");
                        const avgBirthsForSeason = format(birthsForSeason / 10000) + "K"; // Dividing by 1000 (for K) * 10 (for years)
                        const totalBirthsForState = totalBirthsByState.get(stateFIPS) || 0;
                        const percentage = totalBirthsForState > 0 
                            ? ((birthsForSeason / totalBirthsForState) * 100).toFixed(2) 
                            : "0.00";

                        const tooltipContent = `
                            <strong class="custom-state-name">${d.properties.NAME}</strong><br>
                            Avg. #births in ${selectedSeason}: ${avgBirthsForSeason.toLocaleString()}<br>
                            Percentage: ${percentage}%
                        `;

                        d3.select(this)
                            .attr("data-bs-toggle", "tooltip")
                            .attr("data-bs-html", "true")
                            .attr("title", tooltipContent);

                        const tooltipInstance = new bootstrap.Tooltip(this, { html: true });
                        tooltipInstance.show();
                    })
                    .on("mouseout", function () {
                        const tooltipInstance = bootstrap.Tooltip.getInstance(this);
                        if (tooltipInstance) tooltipInstance.dispose();
                    });
            }

            // Initialize map with default season (Spring)
            updateMap("Spring");

            // Update map when dropdown changes
            seasonDropdown.addEventListener("change", function () {
                const selectedSeason = this.value;
                updateMap(selectedSeason);
            });
        });
    });
});