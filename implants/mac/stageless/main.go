package main

import "stageless/routine"

//export StartW
func StartW() {
	Custom()
	routine.MainInit()
}

func main() {
	StartW()
}
