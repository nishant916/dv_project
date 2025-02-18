
const width = 960, height = 600;
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");

// Load baby names data
d3.csv("../data/baby_names.csv").then(data => {
    console.log("Baby Names Data Loaded:", data);

    // Process baby names data: aggregate counts by name
    let nameCountMap = new Map();
    data.forEach(d => {
        let name = d.Name;
        let count = +d.Count;

        if (nameCountMap.has(name)) {
            nameCountMap.set(name, nameCountMap.get(name) + count);
        } else {
            nameCountMap.set(name, count);
        }
    });

    let nameCountArray = Array.from(nameCountMap, ([name, count]) => ({ name, count }));
    nameCountArray.sort((a, b) => b.count - a.count);
    let top10Names = nameCountArray.slice(0, 10);
    console.log("Top 10 Baby Names:", top10Names);

    // Set up the bar chart scales
    const xScale = d3.scaleBand()
        .domain(top10Names.map(d => d.name))
        .range([80, width-50])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(top10Names, d => d.count)* 1.2])
        .range([height-50, 50]);

    // Add x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height - 50})`)
        .call(d3.axisBottom(xScale).tickSize(0)) // Remove tick marks on x-axis
        .selectAll(".tick text")
        .style("text-anchor", "middle") 
        .style("font-size", "14px")
        .style("font-weight", "bold");

    // Add y-axis
    svg.append("g")
        .attr("transform", `translate(80, 0)`)
        .call(d3.axisLeft(yScale)
            .tickSizeOuter(0)) // Remove outer tick marks on y-axis
        .selectAll(".tick text")
        .style("font-size", "14px")
        .style("font-weight", "bold");

    // Add axis labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height-5)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Baby Names");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 15)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Count");

    const defs = svg.append("defs");

    const pattern = defs.append("pattern")
        .attr("id", "stripePattern")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 30) // Adjust width of stripes
        .attr("height", 30);

    pattern.append("rect") 
        .attr("width", 30)
        .attr("height", 30)
        .attr("fill", "#ffc107"); // Background color (Bootstrap warning yellow)

    pattern.append("path")
        .attr("d", "M 0,30 L 30,0") // Creates diagonal stripes
        .attr("stroke", "black")
        .attr("stroke-width", 1);
   
    svg.selectAll(".bar")
        .data(top10Names)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.name))
        .attr("y", d => yScale(d.count))
        .attr("width", xScale.bandwidth())
        .attr("height", d => height - 50 - yScale(d.count)) // Height of the bar
        .attr("fill", "url(#stripePattern)") // Apply pattern
        .attr("stroke", "black") // Optional: Add black outline
        .attr("stroke-width", 1.5)

        .on("mouseover", function(event, d) {
            tooltip.style("display", "block")
                .html(`<strong>${d.name}:</strong> ${d.count}`)
                .style("left", (xScale(d.name) + xScale.bandwidth() / 2) + "px")
                .style("top", (yScale(d.count) - 40) + "px")
               
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX - 50) + "px")
                .style("top", (event.pageY - 50) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("display", "none");
        });
});

