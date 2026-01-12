'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { CourseRequestDate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const courseRequestSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  location: z.string().min(2, 'Location is required'),
  basePrice: z.coerce.number().min(1, 'Price must be greater than 0'),
  partnerDescription: z.string().min(20, 'Description must be at least 20 characters'),
});

type CourseRequestFormData = z.infer<typeof courseRequestSchema>;

interface RequestedDate {
  id: string;
  date: Date | undefined;
  time: string;
  duration: number;
  capacity: number;
  customPrice?: number;
}

export default function NewCourseRequestPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [requestedDates, setRequestedDates] = useState<RequestedDate[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CourseRequestFormData>({
    resolver: zodResolver(courseRequestSchema),
    defaultValues: {
      name: '',
      location: '',
      basePrice: 0,
      partnerDescription: '',
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: {
      name: string;
      location: string;
      basePrice: number;
      partnerDescription: string;
      requestedDates?: CourseRequestDate[];
    }) => api.createCourseRequest(data),
    onSuccess: () => {
      toast.success(t.courseRequest.successMessage);
      router.push('/dashboard/requests');
    },
    onError: () => {
      toast.error(t.courseRequest.errorMessage);
    },
  });

  const onSubmit = (data: CourseRequestFormData) => {
    const formattedDates: CourseRequestDate[] = requestedDates
      .filter((d) => d.date)
      .map((d) => ({
        dateTime: `${format(d.date!, 'yyyy-MM-dd')}T${d.time}:00Z`,
        duration: d.duration,
        capacity: d.capacity,
        customPrice: d.customPrice,
      }));

    createRequestMutation.mutate({
      ...data,
      requestedDates: formattedDates.length > 0 ? formattedDates : undefined,
    });
  };

  const addDate = () => {
    setRequestedDates([
      ...requestedDates,
      {
        id: crypto.randomUUID(),
        date: undefined,
        time: '18:00',
        duration: 180,
        capacity: 10,
      },
    ]);
  };

  const removeDate = (id: string) => {
    setRequestedDates(requestedDates.filter((d) => d.id !== id));
  };

  const updateDate = (id: string, field: keyof RequestedDate, value: unknown) => {
    setRequestedDates(
      requestedDates.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/requests"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.common.back}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.courseRequest.title}</CardTitle>
          <CardDescription>{t.courseRequest.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Course Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t.courseRequest.nameLabel}</Label>
              <Input
                id="name"
                placeholder={t.courseRequest.namePlaceholder}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">{t.courseRequest.locationLabel}</Label>
              <Input
                id="location"
                placeholder={t.courseRequest.locationPlaceholder}
                {...register('location')}
              />
              {errors.location && (
                <p className="text-sm text-destructive">{errors.location.message}</p>
              )}
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="basePrice">{t.courseRequest.priceLabel}</Label>
              <Input
                id="basePrice"
                type="number"
                min="1"
                step="0.01"
                {...register('basePrice')}
              />
              {errors.basePrice && (
                <p className="text-sm text-destructive">{errors.basePrice.message}</p>
              )}
            </div>

            {/* Description for Manager */}
            <div className="space-y-2">
              <Label htmlFor="partnerDescription">{t.courseRequest.descriptionLabel}</Label>
              <textarea
                id="partnerDescription"
                rows={4}
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={t.courseRequest.descriptionPlaceholder}
                {...register('partnerDescription')}
              />
              {errors.partnerDescription && (
                <p className="text-sm text-destructive">{errors.partnerDescription.message}</p>
              )}
            </div>

            {/* Requested Dates Section */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <h3 className="font-medium">{t.courseRequest.datesSection}</h3>
                <p className="text-sm text-muted-foreground">{t.courseRequest.datesDescription}</p>
              </div>

              {requestedDates.map((reqDate) => (
                <div
                  key={reqDate.id}
                  className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 border rounded-lg bg-muted/30"
                >
                  {/* Date Picker */}
                  <div className="col-span-2 flex flex-col">
                    <Label className="text-xs">{t.courseRequest.dateLabel}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal mt-auto',
                            !reqDate.date && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {reqDate.date ? format(reqDate.date, 'PPP') : t.editor.pickDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={reqDate.date}
                          onSelect={(date) => updateDate(reqDate.id, 'date', date)}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Time */}
                  <div className="flex flex-col">
                    <Label className="text-xs">{t.courseRequest.timeLabel}</Label>
                    <Input
                      type="time"
                      value={reqDate.time}
                      onChange={(e) => updateDate(reqDate.id, 'time', e.target.value)}
                      className="mt-auto"
                    />
                  </div>

                  {/* Duration */}
                  <div className="flex flex-col">
                    <Label className="text-xs">{t.courseRequest.durationLabel}</Label>
                    <Input
                      type="number"
                      min="10"
                      max="288"
                      value={reqDate.duration}
                      onChange={(e) => updateDate(reqDate.id, 'duration', Number(e.target.value))}
                      className="mt-auto"
                    />
                  </div>

                  {/* Capacity */}
                  <div className="flex flex-col">
                    <Label className="text-xs">{t.courseRequest.capacityLabel}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={reqDate.capacity}
                      onChange={(e) => updateDate(reqDate.id, 'capacity', Number(e.target.value))}
                      className="mt-auto"
                    />
                  </div>

                  {/* Custom Price + Delete */}
                  <div className="flex flex-col">
                    <Label className="text-xs">{t.courseRequest.customPriceLabel}</Label>
                    <div className="flex items-center gap-2 mt-auto">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="€"
                        value={reqDate.customPrice || ''}
                        onChange={(e) =>
                          updateDate(
                            reqDate.id,
                            'customPrice',
                            e.target.value ? Number(e.target.value) : undefined
                          )
                        }
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDate(reqDate.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addDate} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                {t.courseRequest.addDate}
              </Button>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={createRequestMutation.isPending}>
                {createRequestMutation.isPending
                  ? t.courseRequest.submitting
                  : t.courseRequest.submitRequest}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
