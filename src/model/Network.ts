

class Network {
  constructor(public readonly config: Network.NetworkConfig) {
    this.validate();
  }

  validate() {
    const { input, hidden, output, weights } = this.config;
    if (input < 1) {
      throw new Error("Invalid input count");
    }
    if (hidden.length < 0) {
      throw new Error("Invalid hidden layer count");
    }
    if (output < 1) {
      throw new Error("Invalid output count");
    }
    if (weights.length !== hidden.length + 1) {
      throw new Error("Invalid weight count");
    }
    for (let i = 0; i < weights.length; i++) {
      const layer_in = i === 0 ? input : hidden[i - 1];
      const layer_out = i === hidden.length ? output : hidden[i];
      if (weights[i].length !== layer_out) {
        throw new Error(`Invalid row count for weights layer ${i}`);
      }
      for (let j = 0; j < weights[i].length; j++) {
        if (weights[i][j].length !== layer_in + 1) {
          throw new Error(
            `Invalid col count for weights layer ${i} neuron ${j}`,
          );
        }
      }
    }
  }

  eval(input: number[]): number[] {
    const { weights } = this.config;
    let layer_in = input;
    for (let layer_idx = 0; layer_idx < weights.length; layer_idx++) {
      let layer_out: number[] = [];
      for (
        let neuron_idx = 0;
        neuron_idx < weights[layer_idx].length;
        neuron_idx++
      ) {
        let sum = 0;
        // Weights
        for (let input_idx = 0; input_idx < layer_in.length - 1; input_idx++) {
          sum +=
            layer_in[input_idx] * weights[layer_idx][neuron_idx][input_idx];
        }
        // Bias
        sum += weights[layer_idx][neuron_idx][layer_in.length - 1];
        // Activation
        layer_out.push(this.activation(sum));
      }
      layer_in = layer_out;
    }

    return layer_in;
  }

  activation(value: number): number {
    // Not exactly ReLU, but this is how I set my outputs right now
    if (value < -1) {
      return -1;
    } else if (value > 1) {
      return 1;
    } else {
      return value;
    }
  }
}

module Network {
  export interface NetworkConfig {
    input: number;
    hidden: number[];
    output: number;

    weights: number[][][]; // [layer][neuron][input]
  }
}

export default Network;
