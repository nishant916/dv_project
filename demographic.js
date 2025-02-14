        const width = 960, height = 600;
        const svg = d3.select("svg");
        const tooltip = d3.select(".tooltip");
        
        const colorScale = d3.scaleSequential(d3.interpolateBlues);
        
        d3.csv("demographic_data.csv").then(data => {
            console.log("data =", data);
            
            let stateData = new Map();
            
            data.forEach(d => {
                let state = d.State;
                if (!stateData.has(state)) {
                    stateData.set(state, {
                        totalPopulation: 0,
                        malePopulation: 0,
                        femalePopulation: 0,
                        whitePopulation: 0,
                        blackPopulation: 0,
                        hispanicPopulation: 0
                    });
                }
                let entry = stateData.get(state);
                entry.totalPopulation += +d["Total Population"];
                entry.malePopulation += +d["Male Population"];
                entry.femalePopulation += +d["Female Population"];
                entry.whitePopulation += +d["White Alone"];
                entry.blackPopulation += +d["Black or African American Alone"];
                entry.hispanicPopulation += +d["Hispanic or Latino"];
            });

            console.log(stateData);
            
            const maxPopulation = d3.max(Array.from(stateData.values()), d => d.totalPopulation);
            colorScale.domain([0, maxPopulation]);
            
            d3.json("states.geojson").then(geoData => {
                const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
                const path = d3.geoPath().projection(projection);
                
                svg.selectAll(".state")
                    .data(geoData.features)
                    .join("path")
                    .attr("class", "state")
                    .attr("d", path)
                    .attr("fill", d => {
                        const stateName = d.properties.name;
                        return colorScale(stateData.has(stateName) ? stateData.get(stateName).totalPopulation : 0);
                    })
                    .on("mouseover", (event, d) => {
                        const stateName = d.properties.name;
                        const stateInfo = stateData.get(stateName) || {};
                        tooltip.style("display", "block")
                            .html(`<strong>${stateName}</strong><br>
                                   Population: ${stateInfo.totalPopulation || "No Data"}<br>
                                   Male: ${stateInfo.malePopulation || "No Data"}<br>
                                   Female: ${stateInfo.femalePopulation || "No Data"}<br>
                                   White: ${stateInfo.whitePopulation || "No Data"}<br>
                                   Black: ${stateInfo.blackPopulation || "No Data"}<br>
                                   Hispanic: ${stateInfo.hispanicPopulation || "No Data"}`)
                            .style("left", `${event.pageX + 10}px`)
                            .style("top", `${event.pageY + 10}px`);
                    })
                    .on("mouseout", () => tooltip.style("display", "none"));
            });
        });
