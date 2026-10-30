/* AeroCAD Sim Academy — question bank (Weeks 1–7 + planets + TinkerCAD/Codeblocks).
   Each: w = week (0 = TinkerCAD skills, 9 = planets), q, a = 4 answers, c = correct index, x = why. */
AC.QUESTIONS = [
  // ---------------- Week 1 · Foundations of flight
  { w: 1, q: 'What are the conditions for steady, level flight?', a: ['Lift = Weight and Thrust = Drag', 'Lift > Weight and Thrust > Drag', 'Lift = Thrust and Weight = Drag', 'Only lift has to be big'], c: 0, x: 'Balanced forces mean no acceleration (Newton\'s 1st law), so speed and height stay the same.' },
  { w: 1, q: 'Which way does LIFT act?', a: ['Straight towards the Sun', 'Perpendicular to the relative airflow', 'Along the engine axis', 'Opposite the airflow'], c: 1, x: 'Lift is at 90° to the airflow. Drag is the one that points against the airflow.' },
  { w: 1, q: 'A 1,000 kg aircraft (g = 9.81 m/s²) weighs…', a: ['1,000 N', '98.1 N', '9,810 N', '100,000 N'], c: 2, x: 'W = m × g = 1,000 × 9.81 = 9,810 N. In cruise, lift must also be 9,810 N.' },
  { w: 1, q: 'Convert 250 km/h to knots (1 knot = 1.852 km/h).', a: ['About 463 knots', 'About 135 knots', 'About 69 knots', '250 knots'], c: 1, x: '250 ÷ 1.852 ≈ 135 knots.' },
  { w: 1, q: 'Thrust becomes bigger than drag. What happens?', a: ['The aircraft speeds up', 'The aircraft slows down', 'Nothing changes', 'The aircraft stalls'], c: 0, x: 'Net force forward means forward acceleration (F = ma).' },
  { w: 1, q: 'Where does WEIGHT act?', a: ['Through the wing tips', 'Towards Earth\'s centre, through the centre of gravity', 'Along the propeller', 'Perpendicular to the airflow'], c: 1, x: 'Weight always points to the centre of the Earth, from the CG.' },
  { w: 1, q: 'Which aircraft can hover and needs no runway, but has short endurance?', a: ['Fixed-wing airliner', 'Glider', 'Multirotor drone', 'Hot-air balloon'], c: 2, x: 'Multirotors are simple and controllable but use lots of energy, so flights are short.' },
  { w: 1, q: 'A design that takes off like a drone and cruises like a plane is called…', a: ['Hybrid VTOL', 'Airship', 'Rocket', 'Helicopter'], c: 0, x: 'VTOL = Vertical Take-Off and Landing. Great for medical delivery to islands on Lake Victoria.' },
  { w: 1, q: 'In what year did the Wright Flyer make its first powered flight?', a: ['1799', '1903', '1927', '1969'], c: 1, x: '1903: 12 seconds, 37 metres. George Cayley separated lift, thrust and drag in 1799.' },
  { w: 1, q: 'A vector has…', a: ['Only a size', 'Only a direction', 'Magnitude and direction', 'A colour and a size'], c: 2, x: 'Forces are vectors: how big AND which way.' },
  { w: 1, q: 'Drag acts…', a: ['Upwards', 'Parallel to and opposite the relative airflow', 'Towards the ground', 'Along the wing'], c: 1, x: 'Drag always resists motion through the air.' },
  { w: 1, q: '"Avionics" means…', a: ['Aircraft paint', 'Aviation electronics', 'Airport buildings', 'Airline tickets'], c: 1, x: 'Radios, GPS, instruments, flight computers and autopilots are all avionics.' },

  // ---------------- Week 2 · Aerodynamics & wing design
  { w: 2, q: 'Which is the lift equation?', a: ['L = mg', 'L = ½ ρ v² S C_L', 'L = ½ m v²', 'L = F × d'], c: 1, x: 'ρ = air density, v = airspeed, S = wing area, C_L = lift coefficient.' },
  { w: 2, q: 'If airspeed DOUBLES, lift becomes…', a: ['2 times bigger', 'The same', '4 times bigger', 'Half'], c: 2, x: 'Lift depends on v². 2² = 4.' },
  { w: 2, q: 'In NACA 2412, what does "12" mean?', a: ['Maximum thickness is 12% of the chord', 'Stall at 12°', '12 m wingspan', '12% camber'], c: 0, x: '2 = 2% camber, 4 = at 40% chord, 12 = 12% thickness.' },
  { w: 2, q: 'Why do aircraft need longer runways at high, hot airports like Entebbe?', a: ['The runway is bumpy', 'The air is less dense, so more speed is needed for lift', 'Gravity is stronger there', 'Engines are bigger'], c: 1, x: 'Lower ρ means lower lift at the same speed, so take-off speed rises.' },
  { w: 2, q: 'A wing STALLS when…', a: ['The speed is too high', 'The angle of attack is too high and the airflow separates', 'The engine stops', 'The wing is too long'], c: 1, x: 'Past about 12–16° the flow peels off the top of the wing and lift collapses.' },
  { w: 2, q: 'Roughly at what angle of attack do most wings stall?', a: ['2–4°', '12–16°', '45°', '90°'], c: 1, x: 'Lift grows almost in a straight line until about 12–16°.' },
  { w: 2, q: 'Bernoulli\'s principle says that faster-moving air has…', a: ['Higher pressure', 'Lower pressure', 'The same pressure', 'More weight'], c: 1, x: 'Air speeds up over the top of the wing, so pressure there drops.' },
  { w: 2, q: 'Newton\'s 3rd law explanation of lift:', a: ['The wing pushes air down, so the air pushes the wing up', 'Air is lighter than the wing', 'Gravity switches off', 'The engine pushes the wing up'], c: 0, x: 'Downwash! Bernoulli and Newton describe the same flow.' },
  { w: 2, q: 'Aspect ratio AR =', a: ['Chord ÷ span', 'Span² ÷ wing area', 'Mass ÷ area', 'Speed ÷ time'], c: 1, x: 'Long, thin glider wings have a high aspect ratio.' },
  { w: 2, q: 'Why do gliders have long, thin (high aspect ratio) wings?', a: ['To look nice', 'Lower induced drag', 'To carry more fuel', 'To stall sooner'], c: 1, x: 'Less wing-tip vortex drag means they glide further.' },
  { w: 2, q: 'Air density at sea level is about…', a: ['1.225 kg/m³', '9.81 kg/m³', '1,000 kg/m³', '0.1 kg/m³'], c: 0, x: 'At Entebbe (about 1,150 m) it is about 1.09 kg/m³.' },
  { w: 2, q: 'The upward V angle of the wings (dihedral) improves…', a: ['Top speed', 'Roll stability', 'Engine power', 'Fuel use'], c: 1, x: 'Dihedral helps the aircraft level its wings by itself.' },
  { w: 2, q: 'The chord line joins…', a: ['Wing tip to wing tip', 'Leading edge to trailing edge', 'Nose to tail', 'Engine to wing'], c: 1, x: 'Span is tip to tip; chord is front to back of the airfoil.' },

  // ---------------- Week 3 · Stability & control
  { w: 3, q: 'The principle of moments says that in balance…', a: ['Clockwise moments = anticlockwise moments', 'All forces are zero', 'Mass = weight', 'Lift = thrust'], c: 0, x: 'Moment = force × perpendicular distance.' },
  { w: 3, q: 'Which control surface controls ROLL?', a: ['Elevator', 'Rudder', 'Ailerons', 'Flaps'], c: 2, x: 'Ailerons move in opposite directions on each wing.' },
  { w: 3, q: 'Which control surface controls PITCH (nose up/down)?', a: ['Elevator', 'Rudder', 'Ailerons', 'Spoilers'], c: 0, x: 'The elevator is on the horizontal tail.' },
  { w: 3, q: 'Which control surface controls YAW (nose left/right)?', a: ['Elevator', 'Rudder', 'Ailerons', 'Propeller'], c: 1, x: 'The rudder is on the vertical fin.' },
  { w: 3, q: 'If the CG is BEHIND the neutral point, the aircraft is…', a: ['Very stable', 'Unstable in pitch', 'Faster', 'Lighter'], c: 1, x: 'CG must be ahead of the neutral point for pitch stability.' },
  { w: 3, q: 'What colour light is on the starboard (right) wing tip?', a: ['Red', 'Green', 'White', 'Blue'], c: 1, x: 'Red = port (left), green = starboard (right), white = tail.' },
  { w: 3, q: 'Battery 300 g at 40 mm, frame 200 g at 100 mm, camera 100 g at 160 mm. Where is the CG?', a: ['66.7 mm', '80 mm', '100 mm', '120 mm'], c: 1, x: '(300×40 + 200×100 + 100×160) ÷ 600 = 48,000 ÷ 600 = 80 mm.' },
  { w: 3, q: 'Typical static margin for a stable aircraft?', a: ['0%', '5–15% of the mean chord', '50%', '100%'], c: 1, x: 'Too much margin is sluggish; negative margin is unstable.' },
  { w: 3, q: 'Why are some fighter jets designed to be unstable?', a: ['It saves paint', 'It makes them very agile; computers keep them controllable', 'They fly slower', 'To use less fuel'], c: 1, x: 'Fly-by-wire computers make thousands of tiny corrections per second.' },
  { w: 3, q: 'At night you see an aircraft\'s RED light on your right and GREEN light on your left. It is…', a: ['Flying towards you', 'Flying away from you', 'Parked', 'Upside down'], c: 0, x: 'Facing you, its port (red) wing is on your right. Seeing both red and green means it is coming at you.' },
  { w: 3, q: 'Adverse yaw is caused by…', a: ['Extra drag on the down-going aileron', 'The rudder', 'Too much fuel', 'The landing gear'], c: 0, x: 'Pilots fix it by using rudder in the turn (coordinated turn).' },
  { w: 3, q: 'LED on 5 V: (5 V − 2 V) ÷ 0.015 A ≈ ?', a: ['20 Ω', '200 Ω (use 220 Ω)', '2,000 Ω', '0.2 Ω'], c: 1, x: 'Ohm\'s law R = V ÷ I.' },

  // ---------------- Week 4 · Propulsion & multirotors
  { w: 4, q: 'Why do neighbouring rotors on a quadcopter spin in opposite directions?', a: ['To look cool', 'So their reaction torques cancel and the drone does not spin', 'To go faster', 'To save battery'], c: 1, x: 'Motors 1 & 3 spin CW, 2 & 4 spin CCW.' },
  { w: 4, q: 'How does a quadcopter YAW (turn on the spot)?', a: ['Tilts forward', 'Speeds up one diagonal pair of motors and slows the other', 'Stops all motors', 'Uses a rudder'], c: 1, x: 'The unbalanced reaction torque twists the frame.' },
  { w: 4, q: 'What does "3S" on a LiPo battery mean?', a: ['3 seconds of power', '3 cells in series = 11.1 V', '3 amps', '3 kg'], c: 1, x: '3 × 3.7 V = 11.1 V nominal.' },
  { w: 4, q: 'A 2000 KV motor on 11.1 V spins at about (unloaded)…', a: ['2,000 rpm', '11,100 rpm', '22,200 rpm', '200,000 rpm'], c: 2, x: 'rpm = KV × volts = 2000 × 11.1.' },
  { w: 4, q: 'A 600 g drone has four motors giving 450 g thrust each. T/W =', a: ['1:1', '2:1', '3:1', '4:1'], c: 2, x: '4 × 450 = 1,800 g. 1,800 ÷ 600 = 3.' },
  { w: 4, q: 'What T/W should a stable camera drone have?', a: ['At least 2:1', '0.5:1', 'Exactly 1:1', '10:1 or nothing'], c: 0, x: 'Racers use 5:1 or more. Below 1:1 it cannot even lift off.' },
  { w: 4, q: 'To PITCH FORWARD, the flight controller…', a: ['Speeds up the rear motors, slows the front', 'Speeds up the front motors', 'Speeds up all motors', 'Stops the left motors'], c: 0, x: 'The back lifts, the nose drops, the thrust tilts forward.' },
  { w: 4, q: 'To ROLL RIGHT, the flight controller…', a: ['Speeds up the right pair', 'Speeds up the left pair, slows the right pair', 'Speeds up the CW pair', 'Slows all four'], c: 1, x: 'The left side lifts, so the drone tilts to the right.' },
  { w: 4, q: 'A "5045" propeller is…', a: ['5 inch diameter, 4.5 inch pitch', '50 grams, 45 rpm', '5 blades, 45°', '5,045 rpm'], c: 0, x: 'Pitch = ideal forward distance per revolution.' },
  { w: 4, q: 'Using 1.2 Ah of battery at an average of 12 A gives a flight time of…', a: ['1 minute', '6 minutes', '12 minutes', '60 minutes'], c: 1, x: '1.2 ÷ 12 × 60 = 6 minutes.' },
  { w: 4, q: 'A propeller makes thrust by…', a: ['Pushing air backwards (Newton\'s 3rd law)', 'Making the air hot', 'Magnetism', 'Pulling on the ground'], c: 0, x: 'Thrust ≈ ṁ × (v_exit − v_in): mass flow times the speed added.' },
  { w: 4, q: 'ESC stands for…', a: ['Extra Speed Cable', 'Electronic Speed Controller', 'Engine Start Computer', 'Emergency Stop Circuit'], c: 1, x: 'The ESC drives each brushless motor.' },
  { w: 4, q: 'Frame + electronics 450 g, battery 180 g, camera 150 g, 4 motors × 400 g thrust. Is T/W ≥ 2?', a: ['No, it is 1.5', 'Yes, just: 1,600 ÷ 780 ≈ 2.05', 'Yes, it is 4', 'No, it is 0.9'], c: 1, x: 'All-up mass = 780 g. Very little margin. A lighter battery or stronger motors would help.' },
  { w: 4, q: 'Why is a propeller blade twisted (steeper at the hub)?', a: ['The tip moves faster than the hub', 'To make it stronger', 'To make it quiet', 'It is a mistake'], c: 0, x: 'The twist keeps the angle of attack sensible along the whole blade.' },
  { w: 4, q: 'A LiPo safety rule:', a: ['Charge it in a LiPo bag and never leave it unattended', 'Charge it overnight under your bed', 'Puncture it to check inside', 'Store it in the sun'], c: 0, x: 'Punctured, over-charged or over-discharged LiPos can catch fire.' },

  // ---------------- Week 5 · Structures & materials
  { w: 5, q: 'Stress σ = ?', a: ['Force ÷ area (Pa or N/mm²)', 'Mass × g', 'Force × distance', 'Length ÷ time'], c: 0, x: 'Same force on a smaller area means more stress.' },
  { w: 5, q: 'Why is carbon fibre used in aircraft like the Boeing 787?', a: ['It is cheap', 'Very strong and stiff for its low weight', 'It is heavy', 'It melts easily'], c: 1, x: 'About 50% of a 787 is composite by weight.' },
  { w: 5, q: 'Why print a drone arm lying FLAT on the bed?', a: ['Prints are weakest between layers', 'It prints faster upside down', 'To save colour', 'It does not matter'], c: 0, x: 'Flat printing keeps layer lines along the arm, so bending does not split them.' },
  { w: 5, q: 'Why are triangles used in trusses?', a: ['They look nice', 'A triangle cannot change shape without changing a side length', 'They are heavier', 'They bend easily'], c: 1, x: 'A rectangle squashes into a parallelogram; a triangle stays rigid.' },
  { w: 5, q: 'A 6 N force on an arm with a 40 mm² cross-section gives a stress of…', a: ['240 N/mm²', '0.15 N/mm²', '6.67 N/mm²', '46 N/mm²'], c: 1, x: '6 ÷ 40 = 0.15 N/mm² (MPa).' },
  { w: 5, q: 'A factor of safety of 2 means…', a: ['The part fails at the design load', 'The part can carry twice the design load before failing', 'Two people checked it', 'It is half as strong'], c: 1, x: 'Aircraft typically use 1.5 on ultimate load.' },
  { w: 5, q: 'The main beam inside a wing that carries bending is the…', a: ['Rib', 'Spar', 'Skin', 'Flap'], c: 1, x: 'Ribs keep the airfoil shape; skin carries shear and twisting.' },
  { w: 5, q: 'Specific strength =', a: ['Strength ÷ density', 'Strength × mass', 'Density ÷ strength', 'Weight ÷ area'], c: 0, x: 'Aerospace engineers want strong AND light.' },
  { w: 5, q: 'Where does a drone arm usually break?', a: ['At the tip', 'At the root, where it joins the body', 'In the middle of the motor', 'It never breaks'], c: 1, x: 'Bending stress is highest at the root, so we add fillets and ribs there.' },
  { w: 5, q: 'On an IMU, atan2(ay, az) calculates…', a: ['Roll angle', 'Temperature', 'Battery level', 'Altitude'], c: 0, x: 'Gravity splits between the axes; atan2 recovers the tilt.' },

  // ---------------- Week 6 · Avionics & autopilots
  { w: 6, q: 'An airspeed indicator compares…', a: ['Total (pitot) pressure and static pressure', 'Temperature and humidity', 'Two GPS signals', 'Fuel and oil'], c: 0, x: 'Dynamic pressure q = ½ ρ v².' },
  { w: 6, q: 'Why does GPS need at least FOUR satellites?', a: ['Three for position plus one to fix the receiver\'s clock error', 'Four is a lucky number', 'One per direction', 'It only needs one'], c: 0, x: 'Distance = speed of light × signal travel time.' },
  { w: 6, q: 'What does the D (derivative) term in PID do?', a: ['Damps the motion and reduces overshoot', 'Adds more power', 'Removes all errors forever', 'Turns off the motor'], c: 0, x: 'It reacts to how fast the error is changing.' },
  { w: 6, q: 'Fly-by-wire means…', a: ['The pilot\'s stick sends requests to computers, which move the surfaces', 'The plane is pulled by a wire', 'Kites', 'Radio-controlled toys only'], c: 0, x: 'The Airbus A320 was the first fly-by-wire airliner.' },
  { w: 6, q: 'Too much P (proportional) gain makes a drone…', a: ['Oscillate (wobble up and down)', 'Fly perfectly', 'Lighter', 'Slower'], c: 0, x: 'Add D to calm it down.' },
  { w: 6, q: 'The I (integral) term…', a: ['Removes a long-term steady offset', 'Adds noise', 'Makes the drone spin', 'Is not used'], c: 0, x: 'Useful when the battery is heavier than expected.' },
  { w: 6, q: 'An altimeter is really a…', a: ['Thermometer', 'Barometer calibrated in height', 'Compass', 'Speedometer'], c: 1, x: 'Pressure falls about 12 Pa per metre near the ground.' },
  { w: 6, q: 'An IMU contains…', a: ['Accelerometers and gyroscopes', 'Only a GPS', 'A camera', 'A battery'], c: 0, x: 'It measures acceleration and rotation rate.' },
  { w: 6, q: 'Redundancy in avionics means…', a: ['Duplicate systems so one failure is not catastrophic', 'Removing systems', 'Extra paint', 'Flying slower'], c: 0, x: 'Ask: what happens if this sensor lies?' },
  { w: 6, q: 'The closed control loop is…', a: ['Sense → think → act, repeated', 'Act → stop', 'Think only', 'Random'], c: 0, x: 'Sensors measure, computers decide, actuators correct, hundreds of times a second.' },

  // ---------------- Week 7 · Rockets, orbits & space
  { w: 7, q: 'The formula for orbital velocity is…', a: ['v = √(GM/r)', 'v = mg', 'v = ½ m v²', 'v = d × t'], c: 0, x: 'Gravity provides the centripetal force: GMm/r² = mv²/r.' },
  { w: 7, q: 'Why do rockets use stages?', a: ['To drop empty tanks and engines, so less mass is carried', 'For decoration', 'To make them taller', 'To carry passengers'], c: 0, x: 'The rocket equation has a logarithm: extra fuel gives diminishing returns.' },
  { w: 7, q: 'What size is a 1U CubeSat?', a: ['1 m cube', '10 × 10 × about 11 cm', '1 cm cube', '50 × 50 cm'], c: 1, x: 'PearlAfricaSat-1 was a 1U CubeSat.' },
  { w: 7, q: 'Telemetry is…', a: ['Data sent from a vehicle to a ground station', 'A type of fuel', 'A rocket engine', 'A planet'], c: 0, x: 'Your BMP280 altimeter sends telemetry over Serial.' },
  { w: 7, q: 'The Kármán line, a common edge of space, is at about…', a: ['10 km', '100 km', '1,000 km', '35,786 km'], c: 1, x: 'Airliners cruise at about 11 km.' },
  { w: 7, q: 'The ISS at 400 km travels at about…', a: ['0.34 km/s', '7.7 km/s', '30 km/s', '300,000 km/s'], c: 1, x: 'About 27,600 km/h.' },
  { w: 7, q: 'One orbit of the ISS takes about…', a: ['24 hours', '92 minutes', '7 days', '10 minutes'], c: 1, x: 'So astronauts see about 16 sunrises a day.' },
  { w: 7, q: 'Rockets work in the vacuum of space because…', a: ['They carry their own oxidiser', 'Space has air', 'They use propellers', 'They push on the stars'], c: 0, x: 'Jet engines need air; rockets do not.' },
  { w: 7, q: 'Launching from near the Equator (like Uganda) gives a free boost of up to…', a: ['465 m/s', '9.81 m/s', '7.7 km/s', 'Nothing'], c: 0, x: 'Earth\'s surface spins east at about 465 m/s at the Equator.' },
  { w: 7, q: 'Uganda\'s first satellite, PearlAfricaSat-1, was…', a: ['A 1U CubeSat deployed from the ISS in 2023', 'A space station', 'A Mars rover', 'A rocket'], c: 0, x: 'Built by Ugandan engineers in Japan\'s BIRDS-5 programme, for Earth observation.' },
  { w: 7, q: 'Geostationary satellites orbit at about…', a: ['400 km', '2,000 km', '35,786 km', '384,400 km'], c: 2, x: 'They go round once a day, so they hover over one spot.' },
  { w: 7, q: 'Being in orbit means…', a: ['Gravity is switched off', 'Falling around the Earth while moving sideways fast enough', 'Floating above the air', 'Standing still'], c: 1, x: 'Newton\'s cannonball: fire it fast enough and the ground curves away as it falls.' },
  { w: 7, q: 'Air density halves roughly every…', a: ['5.5 km', '100 km', '1 m', '50 km'], c: 0, x: 'That is why wings and jet engines stop working high up.' },
  { w: 7, q: 'ADCS on a satellite stands for…', a: ['Attitude Determination and Control System', 'Automatic Data Copy System', 'Air Defence Control Station', 'Antenna Direction Cable Set'], c: 0, x: 'Reaction wheels and magnetorquers point the satellite.' },

  // ---------------- Planets
  { w: 9, q: 'Which planet is closest to the Sun?', a: ['Venus', 'Mercury', 'Mars', 'Earth'], c: 1, x: 'Order: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.' },
  { w: 9, q: 'The largest planet is…', a: ['Saturn', 'Earth', 'Jupiter', 'Neptune'], c: 2, x: 'Jupiter could hold more than 1,300 Earths.' },
  { w: 9, q: 'Gravity on the Moon is about…', a: ['The same as Earth', '1/6 of Earth\'s (1.62 m/s²)', 'Twice Earth\'s', 'Zero'], c: 1, x: 'You could jump about 6 times higher.' },
  { w: 9, q: 'You travel from Earth to Mars. Your MASS…', a: ['Gets smaller', 'Stays the same; your weight gets smaller', 'Gets bigger', 'Becomes zero'], c: 1, x: 'Mass is how much stuff you are made of. Weight = m × g changes with g.' },
  { w: 9, q: 'Planets further from the Sun…', a: ['Orbit faster', 'Orbit slower and take longer to go round', 'Do not orbit', 'All take one year'], c: 1, x: 'Neptune takes about 165 Earth years to go round once.' },
  { w: 9, q: 'On which of these could you jump highest?', a: ['Earth', 'Mars', 'Jupiter', 'Neptune'], c: 1, x: 'Mars g = 3.71 m/s², lowest of these. Height = v² ÷ 2g.' },
  { w: 9, q: 'A hammer and a feather are dropped on the Moon. They…', a: ['Land at the same time', 'The hammer lands first', 'The feather lands first', 'Float away'], c: 0, x: 'No air, so no drag. Apollo 15 astronaut David Scott did this in 1971.' },
  { w: 9, q: 'Which planet has the strongest surface gravity?', a: ['Earth', 'Mars', 'Jupiter', 'Mercury'], c: 2, x: 'About 24.8 m/s², 2.5 times Earth\'s.' },

  // ---------------- TinkerCAD & Codeblocks skills
  { w: 0, q: 'In TinkerCAD, which shortcut DUPLICATES a shape?', a: ['Ctrl + D', 'Ctrl + G', 'L', 'M'], c: 0, x: 'Ctrl + G groups, L aligns, M mirrors.' },
  { w: 0, q: 'In TinkerCAD, which shortcut GROUPS shapes?', a: ['Ctrl + D', 'Ctrl + G', 'Ctrl + Z', 'Ctrl + P'], c: 1, x: 'Group joins shapes; a "hole" shape cuts when grouped.' },
  { w: 0, q: 'In Codeblocks, to place 4 drone arms evenly around the centre, rotate each copy by…', a: ['45°', '90°', '120°', '360°'], c: 1, x: '360° ÷ 4 = 90°. Use a Repeat 4 block.' },
  { w: 0, q: 'In Codeblocks, 3 rocket fins evenly spaced need a rotation of…', a: ['90°', '60°', '120°', '180°'], c: 2, x: '360° ÷ 3 = 120°.' },
  { w: 0, q: 'Which Codeblocks block runs the same steps many times?', a: ['Repeat', 'Add shape', 'Move', 'Hide'], c: 0, x: 'Loops save time and make patterns.' },
  { w: 0, q: 'What makes CAD "parametric"?', a: ['Dimensions drive the geometry: change a number and the model updates', 'It is in colour', 'It runs on a phone', 'It has no numbers'], c: 0, x: 'In Codeblocks, a variable such as ArmLength does the same job.' },
  { w: 0, q: 'In TinkerCAD, how do you cut a hole in a box?', a: ['Make a shape a "Hole" and Group it with the box', 'Delete the box', 'Paint it black', 'Press M'], c: 0, x: 'This is how motor holes and windows are made.' },
];
AC.WEEKS = {
  0: 'TinkerCAD & Codeblocks', 1: 'Foundations of Flight', 2: 'Aerodynamics & Wings', 3: 'Stability & Control', 4: 'Propulsion & Multirotors',
  5: 'Structures & Materials', 6: 'Avionics & Autopilots', 7: 'Rockets, Orbits & Space', 9: 'Planets',
};
AC.questionsFor = function (weeks, n) {
  const pool = AC.QUESTIONS.filter((q) => !weeks || weeks.includes(q.w));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return n ? pool.slice(0, n) : pool;
};
// shuffle answers but keep track of the right one
AC.shuffleQ = function (q) {
  const idx = q.a.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return Object.assign({}, q, { a: idx.map((i) => q.a[i]), c: idx.indexOf(q.c) });
};
