import gaussian from "../utils/gaussian";

class Network {
  constructor(public readonly config: Network.Configuration) {
    this.validate();
  }

  static init(input: number, output: number, hidden: number[]): Network {
    if (!input) {
      throw new Error("Invalid input count");
    }
    if (!output) {
      throw new Error("Invalid output count");
    }
    if (!hidden) {
      hidden = [];
    }

    const weights = [];
    for (let i = 0; i < hidden.length + 1; i++) {
      const layer_in = i === 0 ? input : hidden[i - 1];
      const layer_out = i === hidden.length ? output : hidden[i];
      const layer = [];
      for (let j = 0; j < layer_out; j++) {
        const neuron = [];
        for (let k = 0; k < layer_in + 1; k++) {
          neuron.push(0);
        }
        layer.push(neuron);
      }
      weights.push(layer);
    }
    return new Network({ input, output, hidden, weights });
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
    const weights = this.config.weights;
    let layer_in = input;
    for (let layer_idx = 0; layer_idx < weights.length; layer_idx++) {
      let layer_out: number[] = [];
      for (let idx_out = 0; idx_out < weights[layer_idx].length; idx_out++) {
        // Bias
        let sum = weights[layer_idx][idx_out][layer_in.length - 1];
        // Weights
        for (let idx_in = 0; idx_in < layer_in.length - 1; idx_in++) {
          sum += layer_in[idx_in] * weights[layer_idx][idx_out][idx_in];
        }
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

  randomStep(stdev: number): Network {
    return new Network({
      ...this.config,
      weights: this.config.weights.map((layer) =>
        layer.map((neuron) => neuron.map((weight) => gaussian(weight, stdev))),
      ),
    });
  }
}

module Network {
  export interface Configuration {
    input: number;
    hidden: number[];
    output: number;

    weights: number[][][]; // [layer][neuron][input]
  }
}

export default Network;
