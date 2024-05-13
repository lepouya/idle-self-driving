# Idle Self-Driving

Playing with this idea I have for a self-training driving system.

- Can have up to 5 sensors ranging from -90 (left) to 0 (front) to +90 (right)
- Sensors can have range and attenuation functions
- Car has 2 basic inputs: acceleration [-1, 1] and steering [-1, 1]. Might have to normalize to 0-1
- Should probably customize accel/break/steer functions too. And top speed
- There are courses to choose for driving in. If the car hits any of the curbs, that drive is over.
- Drives are scored based on how far the car safely made it and how quickly it got there
- Each iteration, some number of randomized networks are generated based on previous round's best run (or 2 best?)
- Can visualize what the best network looks like so far.
- Can also visualize what each individual instance of car is doing.
- Can choose to change the network topography, or reset it
- Import / export of settings and network

## TODO

- ~~Set up project skeleton~~
- ~~Road object and rendering~~
- ~~Car object and rendering~~
- ~~Sensor objects and rendering~~
- Network objects and rendering
- Racing and scoring
- Auto run multiple instances at once
- Tweaks
