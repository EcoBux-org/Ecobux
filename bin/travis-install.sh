#!/bin/bash
npm install
npm install -g truffle
ganache-cli --gasLimit 8000000 2> /dev/null 1> /dev/null & 
