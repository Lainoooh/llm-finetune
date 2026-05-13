export const initialServers = [
  {
    id: "srv-a",
    name: "A100-训练机-01",
    host: "10.20.1.11",
    user: "root",
    password: "********",
    status: "online",
    gpu: "4 × NVIDIA A100 80GB",
    cuda: "12.1",
    torch: "2.4.0+cu121",
    llamafactory: "0.9.2.dev0",
    workDir: "/workspace/finetune-platform",
    disk: "3.8TB / 7.0TB",
  },
  {
    id: "srv-b",
    name: "H800-训练机-02",
    host: "10.20.1.22",
    user: "root",
    password: "********",
    status: "online",
    gpu: "8 × NVIDIA H800 80GB",
    cuda: "12.4",
    torch: "2.5.1+cu124",
    llamafactory: "0.9.3",
    workDir: "/data/finetune-platform",
    disk: "9.2TB / 15.0TB",
  },
];

export const initialTask = {
  id: "bt-001",
  name: "customer_service_v1",
  modelName: "customer_service_v1",
  status: "waiting",
  subtasks: [
    {
      id: "task_001",
      name: "rank16_lr5e-5",
      serverName: "A100-训练机-01",
      status: "succeeded",
      gpu: "0,1",
      learningRate: "5e-5",
      epoch: 3,
      batchSize: 2,
      step: 500,
      loss: 0.91,
      score: 76.2,
      outputDir: "/workspace/finetune-platform/outputs/customer_service_v1/task_001",
    },
    {
      id: "task_002",
      name: "rank32_lr5e-5",
      serverName: "H800-训练机-02",
      status: "running",
      gpu: "2,3,4,5",
      learningRate: "5e-5",
      epoch: 3,
      batchSize: 2,
      step: 500,
      loss: 0.81,
      score: null,
      outputDir: "/data/finetune-platform/outputs/customer_service_v1/task_002",
    },
    {
      id: "task_003",
      name: "rank16_lr1e-4",
      serverName: "A100-训练机-01",
      status: "failed",
      gpu: "3",
      learningRate: "1e-4",
      epoch: 2,
      batchSize: 1,
      step: 300,
      loss: 0.99,
      score: 73.6,
      outputDir: "/workspace/finetune-platform/outputs/customer_service_v1/task_003",
    },
  ],
};

export const lossData = [
  { step: 0, a: 2.41, b: 2.38, c: 2.44 },
  { step: 100, a: 1.82, b: 1.78, c: 1.91 },
  { step: 200, a: 1.43, b: 1.36, c: 1.51 },
  { step: 300, a: 1.21, b: 1.08, c: 1.29 },
  { step: 400, a: 1.06, b: 0.94, c: 1.16 },
  { step: 500, a: 0.98, b: 0.86, c: 1.05 },
  { step: 600, a: 0.91, b: 0.81, c: 0.99 },
];

export const logs = [
  "[2026-05-06 10:21:01] precheck: ssh connected, workspace writable",
  "[2026-05-06 10:21:03] detected llamafactory-cli: 0.9.3",
  "[2026-05-06 10:21:05] dataset_info.json synced on remote server",
  "[2026-05-06 10:21:09] CUDA_VISIBLE_DEVICES=2,3,4,5",
  "[2026-05-06 10:21:11] llamafactory-cli train configs/train.yaml",
  "[2026-05-06 10:22:20] step=10 loss=2.114 lr=4.1e-06 grad_norm=0.82",
  "[2026-05-06 10:24:22] step=20 loss=1.932 lr=8.3e-06 grad_norm=0.77",
  "[2026-05-06 10:26:23] step=30 loss=1.734 lr=1.2e-05 grad_norm=0.69",
  "[2026-05-06 10:28:25] step=40 loss=1.571 lr=1.6e-05 grad_norm=0.61",
];

export const yamlText = `model_name_or_path: /models/Qwen/Qwen3-8B
stage: sft
do_train: true
finetuning_type: lora
lora_rank: 32
lora_alpha: 64
dataset: qa_sft_train_202605
eval_dataset: qa_sft_eval_202605
template: qwen
output_dir: /data/finetune-platform/outputs/customer_service_v1/task_002
learning_rate: 0.00005
num_train_epochs: 3
per_device_train_batch_size: 2
save_steps: 500
bf16: true`;

export const evalYaml = `model_name_or_path: /models/Qwen/Qwen3-8B
adapter_name_or_path: /data/finetune-platform/outputs/customer_service_v1/task_002/adapter
finetuning_type: lora
template: qwen
task: ceval_validation
lang: zh
n_shot: 5
batch_size: 4`;

export const datasetInfo = `{
  "qa_sft_train_202605": {
    "file_name": "qa_sft_train_202605.jsonl",
    "columns": {
      "prompt": "instruction",
      "query": "input",
      "response": "output"
    }
  }
}`;

export const directoryLines = [
  "outputs/customer_service_v1/",
  "  task_002/",
  "    configs/train.yaml",
  "    logs/train.log",
  "    adapter/",
  "    eval/",
];
