const PanamaJungle = artifacts.require("PanamaJungle");

var allotments = require("./allotments.json");

console.log("start")

function failureCallback(error) {
  console.error("Error generating allotments: " + error);
}

module.exports = async (config) => {
  let instance = await PanamaJungle.at("0x9383245Fe30881A3d6a5c3C8df783B6e1579e83e")
  let accounts = await web3.eth.getAccounts()

  allotments = allotments.slice(0,2);
  console.log("Allotments to be added: " + allotments.length)
  for (i = 0; i < allotments.length; i++) {
    console.log(allotments[i])
  }
  result = instance.createAllotment(
    allotments,
    {from: accounts[0]}
  ).then(function(result) {
    console.log("yes");
    return result;
  }, failureCallback);

  //console.log(result);
}
console.log("eof")
