import { MetricServiceClient, protos } from '@google-cloud/monitoring';
import { v1beta1 } from '@google-cloud/service-usage';
import { NextRequest, NextResponse } from 'next/server';

interface QuotaUsageResponse {
  currentUsage: number;
  dailyLimit: number;
  usagePercentage: number;
  model: string;
}

// In-memory cache for quota limits to reduce API calls
interface CachedQuota {
  dailyLimit: number;
  timestamp: number;
}
const quotaCache = new Map<string, CachedQuota>();
const CACHE_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectNumber = searchParams.get('projectNumber');
    const model = searchParams.get('model');

    if (!projectNumber) {
      return NextResponse.json({ error: 'Project number is required' }, { status: 400 });
    }

    if (!model) {
      return NextResponse.json({ error: 'Model parameter is required' }, { status: 400 });
    }

    const projectId = projectNumber;

    // Initialize clients with authentication
    let serviceUsageClient: v1beta1.ServiceUsageClient;
    let monitoringClient: MetricServiceClient;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      serviceUsageClient = new v1beta1.ServiceUsageClient({ credentials });
      monitoringClient = new MetricServiceClient({ credentials });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      serviceUsageClient = new v1beta1.ServiceUsageClient();
      monitoringClient = new MetricServiceClient();
    } else {
      serviceUsageClient = new v1beta1.ServiceUsageClient();
      monitoringClient = new MetricServiceClient();
    }

    // Configuration
    const serviceName = 'generativelanguage.googleapis.com';
    const usageMetric = 'generativelanguage.googleapis.com/quota/generate_requests_per_model/usage';

    let dailyLimit: number | null = null;

    // Step 1: Get quota limits from cache or API
    const cachedQuota = quotaCache.get(model);
    if (cachedQuota && Date.now() - cachedQuota.timestamp < CACHE_TTL_MS) {
      dailyLimit = cachedQuota.dailyLimit;
    } else {
      try {
        const quotaRequest = {
          parent: `projects/${projectId}/services/${serviceName}`,
        };

        const [metrics] = await serviceUsageClient.listConsumerQuotaMetrics(quotaRequest);

        for (const metric of metrics) {
          if (!metric.name || !metric.consumerQuotaLimits) continue;

          for (const limit of metric.consumerQuotaLimits) {
            if (!limit.quotaBuckets || !limit.unit) continue;

            const isDailyLimit =
              limit.unit.includes('/d/') &&
              (limit.unit.includes('{project}') || limit.unit.includes('{model}'));

            if (isDailyLimit) {
              for (const bucket of limit.quotaBuckets) {
                if (bucket.dimensions?.model === model && bucket.effectiveLimit) {
                  dailyLimit = parseInt(String(bucket.effectiveLimit), 10);
                  break;
                }
              }
            }
            if (dailyLimit !== null) break;
          }
          if (dailyLimit !== null) break;
        }

        if (dailyLimit !== null) {
          quotaCache.set(model, { dailyLimit, timestamp: Date.now() });
        } else {
          return NextResponse.json(
            { error: `No quota limit configured for model "${model}" in this project` },
            { status: 404 },
          );
        }
      } catch (error) {
        console.error('Error fetching quota limits:', error);
        return NextResponse.json(
          { error: 'Failed to fetch quota limits from Google Cloud' },
          { status: 500 },
        );
      }
    }

    // Step 2: Get current usage from Cloud Monitoring API
    let currentUsage = 0;

    try {
      const now = new Date();
      const todayMidnightUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const sevenAmUTC = new Date(todayMidnightUTC.getTime() + 7 * 60 * 60 * 1000);

      const monitoringRequest = {
        name: `projects/${projectId}`,
        filter: `metric.type = "${usageMetric}" AND metric.label.model = "${model}"`,
        interval: {
          startTime: {
            seconds: Math.floor(sevenAmUTC.getTime() / 1000),
          },
          endTime: {
            seconds: Math.floor(now.getTime() / 1000),
          },
        },
        aggregation: {
          alignmentPeriod: { seconds: 86400 },
          perSeriesAligner: protos.google.monitoring.v3.Aggregation.Aligner.ALIGN_SUM,
          crossSeriesReducer: protos.google.monitoring.v3.Aggregation.Reducer.REDUCE_SUM,
        },
      };

      const [timeSeries] = await monitoringClient.listTimeSeries(monitoringRequest);

      if (
        timeSeries.length > 0 &&
        timeSeries[0] &&
        timeSeries[0].points &&
        timeSeries[0].points.length > 0
      ) {
        const point = timeSeries[0].points[0];
        if (point && point.value) {
          currentUsage = Number(point.value.doubleValue || point.value.int64Value || 0);
        }
      } else {
      }
    } catch (error) {
      // Non-fatal, we can still return the limit
    }

    const usagePercentage = dailyLimit > 0 ? Math.round((currentUsage / dailyLimit) * 100) : 0;

    const quotaData: QuotaUsageResponse = {
      currentUsage,
      dailyLimit,
      usagePercentage,
      model,
    };

    return NextResponse.json(quotaData);
  } catch (error) {
    console.error('Quota monitoring error:', error);

    let errorMessage = 'Failed to fetch quota information';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('auth') || error.message.includes('credential')) {
        errorMessage = 'Authentication failed. Please check your Google Cloud credentials.';
        statusCode = 401;
      } else if (error.message.includes('permission') || error.message.includes('denied')) {
        errorMessage = 'Permission denied. Please check your IAM permissions.';
        statusCode = 403;
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        errorMessage = 'Service or project not found. Please verify your project number.';
        statusCode = 404;
      }
    }

    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: statusCode },
    );
  }
}
