'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Trash2, Plus, Lock, Pencil, ArrowLeft, User, Mail, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { CourseDate, ManagerCourse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';

const courseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  basePrice: z.number().min(0, 'Price must be positive'),
  status: z.enum(['active', 'inactive']),
});

type CourseFormValues = z.infer<typeof courseSchema>;

// Parse datetime string without timezone conversion (treat as local time)
const parseAsLocalTime = (dateTimeStr: string) => {
  // Remove Z suffix to prevent UTC conversion
  return new Date(dateTimeStr.replace('Z', ''));
};

export default function ManagerCourseEditorPage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const managerCourses = t.managerCourses as Record<string, string> | undefined;

  const [isAddDateDialogOpen, setIsAddDateDialogOpen] = useState(false);
  const [newDateForm, setNewDateForm] = useState({
    dateTime: new Date(),
    capacity: 10,
    duration: 180,
    price: 0,
  });
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editedPrice, setEditedPrice] = useState<number>(0);
  const [editingSeatsId, setEditingSeatsId] = useState<number | null>(null);
  const [editedSeats, setEditedSeats] = useState<number>(0);
  const [editingDateId, setEditingDateId] = useState<number | null>(null);
  const [editedDate, setEditedDate] = useState<Date>(new Date());
  const [editingTimeId, setEditingTimeId] = useState<number | null>(null);
  const [editedTime, setEditedTime] = useState<string>('00:00');
  const [editingDurationId, setEditingDurationId] = useState<number | null>(null);
  const [editedDuration, setEditedDuration] = useState<number>(0);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  const { data: course, isLoading: isCourseLoading } = useQuery({
    queryKey: ['manager-course', id],
    queryFn: () => api.getManagerCourse(id),
    enabled: hasHydrated && !!id,
  });

  const { data: existingDates, isLoading: isDatesLoading } = useQuery({
    queryKey: ['manager-course-dates', id],
    queryFn: () => api.getManagerCourseDates(id),
    enabled: hasHydrated && !!id,
  });

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: '',
      basePrice: 0,
      status: 'active',
    },
  });

  useEffect(() => {
    if (course) {
      form.reset({
        title: course.title,
        basePrice: course.basePrice,
        status: course.status,
      });
    }
  }, [course, form]);

  const updateCourseMutation = useMutation({
    mutationFn: (data: { title?: string; status?: 'active' | 'inactive'; basePrice?: number }) =>
      api.updateManagerCourse(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-courses'] });
      queryClient.invalidateQueries({ queryKey: ['manager-course', id] });
    },
  });

  const createDateMutation = useMutation({
    mutationFn: (data: { dateTime: string; capacity: number; duration?: number; price?: number }) =>
      api.createManagerCourseDate(Number(id), data),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['manager-course-dates', id] });
    },
  });

  const deleteDateMutation = useMutation({
    mutationFn: (dateId: number) => api.deleteManagerCourseDate(Number(id), dateId),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['manager-course-dates', id] });
    },
  });

  const updateDateMutation = useMutation({
    mutationFn: ({ dateId, price, seats }: { dateId: number; price?: number; seats?: number }) =>
      api.updateManagerCourseDate(Number(id), dateId, { price, seats }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['manager-course-dates', id] });
    },
  });

  const updateDateTimeMutation = useMutation({
    mutationFn: ({ dateId, dateTime }: { dateId: number; dateTime: string }) =>
      api.updateManagerCourseDateDateTime(Number(id), dateId, dateTime),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['manager-course-dates', id] });
    },
  });

  const updateDurationMutation = useMutation({
    mutationFn: ({ dateId, duration }: { dateId: number; duration: number }) =>
      api.updateManagerCourseDateDuration(Number(id), dateId, duration),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['manager-course-dates', id] });
    },
  });

  const onSubmit = async (data: CourseFormValues) => {
    try {
      await updateCourseMutation.mutateAsync({
        title: data.title,
        status: data.status,
        basePrice: data.basePrice,
      });
      toast.success(managerCourses?.saveSuccess || 'Course saved successfully');
    } catch (error) {
      toast.error(managerCourses?.saveError || 'Failed to save course');
      console.error(error);
    }
  };

  const handleAddDate = async () => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 2);
    minDate.setHours(0, 0, 0, 0);

    if (newDateForm.dateTime < minDate) {
      toast.error(`Date must be at least 2 days in the future (from ${format(minDate, 'PPP')})`);
      return;
    }

    try {
      await createDateMutation.mutateAsync({
        dateTime: format(newDateForm.dateTime, "yyyy-MM-dd'T'HH:mm:ss"),
        capacity: newDateForm.capacity,
        duration: newDateForm.duration,
        price: newDateForm.price,
      });
      setIsAddDateDialogOpen(false);

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 2);

      setNewDateForm({
        dateTime: nextDate,
        capacity: 10,
        duration: 180,
        price: course?.basePrice || 0,
      });
      toast.success(managerCourses?.dateAdded || 'Date added');
    } catch (error) {
      toast.error('Failed to add date');
      console.error(error);
    }
  };

  const handleRemoveDate = async (dateId: number) => {
    try {
      await deleteDateMutation.mutateAsync(dateId);
      toast.success(managerCourses?.dateDeleted || 'Date deleted');
    } catch (error) {
      toast.error('Failed to delete date');
      console.error(error);
    }
  };

  const handleUpdatePrice = async (dateId: number, price: number) => {
    try {
      await updateDateMutation.mutateAsync({ dateId, price });
      setEditingPriceId(null);
      toast.success(managerCourses?.dateUpdated || 'Date updated');
    } catch (error) {
      toast.error('Failed to update price');
      console.error(error);
    }
  };

  const startEditingPrice = (dateId: number, currentPrice: number) => {
    setEditingPriceId(dateId);
    setEditedPrice(currentPrice);
  };

  const handleUpdateSeats = async (dateId: number, seats: number) => {
    try {
      await updateDateMutation.mutateAsync({ dateId, seats });
      setEditingSeatsId(null);
      toast.success(managerCourses?.dateUpdated || 'Date updated');
    } catch (error) {
      toast.error('Failed to update seats');
      console.error(error);
    }
  };

  const startEditingSeats = (dateId: number, currentSeats: number) => {
    setEditingSeatsId(dateId);
    setEditedSeats(currentSeats);
  };

  const startEditingDate = (dateId: number, currentDateTime: string) => {
    setEditingDateId(dateId);
    setEditedDate(parseAsLocalTime(currentDateTime));
  };

  const handleUpdateDate = async (dateId: number, newDate: Date, currentDateTime: string) => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 2);
    minDate.setHours(0, 0, 0, 0);

    if (newDate < minDate) {
      toast.error(`Date must be at least 2 days in the future (from ${format(minDate, 'PPP')})`);
      return;
    }

    try {
      const currentTime = parseAsLocalTime(currentDateTime);
      newDate.setHours(currentTime.getHours(), currentTime.getMinutes(), 0, 0);
      const dateTimeStr = format(newDate, "yyyy-MM-dd'T'HH:mm:ss");
      await updateDateTimeMutation.mutateAsync({ dateId, dateTime: dateTimeStr });
      setEditingDateId(null);
      toast.success(managerCourses?.dateUpdated || 'Date updated');
    } catch (error) {
      toast.error('Failed to update date');
      console.error(error);
    }
  };

  const startEditingTime = (dateId: number, currentDateTime: string) => {
    setEditingTimeId(dateId);
    setEditedTime(format(parseAsLocalTime(currentDateTime), 'HH:mm'));
  };

  const handleUpdateTime = async (dateId: number, newTime: string, currentDateTime: string) => {
    try {
      const [hours, minutes] = newTime.split(':').map(Number);
      const newDateTime = parseAsLocalTime(currentDateTime);
      newDateTime.setHours(hours, minutes, 0, 0);
      const dateTimeStr = format(newDateTime, "yyyy-MM-dd'T'HH:mm:ss");
      await updateDateTimeMutation.mutateAsync({ dateId, dateTime: dateTimeStr });
      setEditingTimeId(null);
      toast.success(managerCourses?.dateUpdated || 'Date updated');
    } catch (error) {
      toast.error('Failed to update time');
      console.error(error);
    }
  };

  const startEditingDuration = (dateId: number, currentDuration: number) => {
    setEditingDurationId(dateId);
    setEditedDuration(currentDuration || 0);
  };

  const handleUpdateDuration = async (dateId: number, duration: number) => {
    try {
      await updateDurationMutation.mutateAsync({ dateId, duration });
      setEditingDurationId(null);
      toast.success(managerCourses?.dateUpdated || 'Date updated');
    } catch (error) {
      toast.error('Failed to update duration');
      console.error(error);
    }
  };

  if (isCourseLoading || isDatesLoading) {
    return <div className="p-8">{(t.common?.loading as string) || 'Loading...'}</div>;
  }

  if (!course) {
    return <div className="p-8">Course not found</div>;
  }

  const dates = existingDates || [];
  const managerCourse = course as ManagerCourse;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/manager/courses">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {(t.common?.back as string) || 'Back'}
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{managerCourses?.editCourse || 'Edit Course'}</h1>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting || updateCourseMutation.isPending}>
          {form.formState.isSubmitting ? ((t.common?.loading as string) || 'Loading...') : ((t.common?.save as string) || 'Save')}
        </Button>
      </div>

      {/* Partner Info Card */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {managerCourses?.partnerInfo || 'Partner Information'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{managerCourse.partnerName || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{managerCourse.partnerEmail || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-mono">{managerCourse.customerNumber || '-'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{managerCourses?.courseInfo || 'Course Information'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">{managerCourses?.titleLabel || 'Title'}</Label>
                <Input id="title" {...form.register('title')} />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="basePrice">{managerCourses?.priceLabel || 'Base Price (€)'}</Label>
                <Input
                  id="basePrice"
                  type="number"
                  step="0.01"
                  {...form.register('basePrice', { valueAsNumber: true })}
                />
                {form.formState.errors.basePrice && (
                  <p className="text-sm text-destructive">{form.formState.errors.basePrice.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">{managerCourses?.statusLabel || 'Status'}</Label>
                <Select
                  onValueChange={(value) => form.setValue('status', value as 'active' | 'inactive')}
                  value={form.watch('status')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{managerCourses?.active || 'Active'}</SelectItem>
                    <SelectItem value="inactive">{managerCourses?.inactive || 'Inactive'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Read-only fields */}
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  {managerCourses?.skuLabel || 'SKU'}
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </Label>
                <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed text-muted-foreground">
                  {course.sku}
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  {managerCourses?.locationLabel || 'Location'}
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </Label>
                <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed text-muted-foreground">
                  {course.location || '-'}
                </div>
              </div>
              {course.description && (
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    {managerCourses?.descLabel || 'Description'}
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <div
                    className="min-h-[100px] max-h-[200px] overflow-auto rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed"
                    dangerouslySetInnerHTML={{ __html: course.description }}
                  />
                </div>
              )}
              {course.image && (
                <div className="grid gap-2">
                  <Label>{managerCourses?.imageLabel || 'Course Image'}</Label>
                  <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                    <img src={course.image} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>{managerCourses?.inventory || 'Events Management'}</CardTitle>
                <CardDescription>{managerCourses?.inventoryDesc || 'Manage dates and capacity.'}</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const nextDate = new Date();
                  nextDate.setDate(nextDate.getDate() + 2);
                  setNewDateForm({
                    dateTime: nextDate,
                    capacity: 10,
                    duration: 180,
                    price: course?.basePrice || 0,
                  });
                  setIsAddDateDialogOpen(true);
                }}
                variant="secondary"
              >
                <Plus className="h-4 w-4 mr-1" /> {managerCourses?.addDate || 'Add Date'}
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">{managerCourses?.dateHeader || 'Date'}</TableHead>
                    <TableHead>{managerCourses?.timeHeader || 'Time'}</TableHead>
                    <TableHead className="w-[100px]">{managerCourses?.durationHeader || 'Duration (Min)'}</TableHead>
                    <TableHead className="w-[90px]">{managerCourses?.capacityHeader || 'Capacity'}</TableHead>
                    <TableHead className="w-[110px]">{managerCourses?.price || 'Price'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                        {managerCourses?.noDatesYet || 'No dates added yet.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    dates.map((date: CourseDate) => (
                      <TableRow key={date.id}>
                        <TableCell>
                          {editingDateId === date.id ? (
                            <div className="flex items-center gap-1">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="h-8 text-sm px-2">
                                    <CalendarIcon className="mr-1 h-3 w-3" />
                                    {format(editedDate, 'PPP')}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={editedDate}
                                    onSelect={(d) => {
                                      if (d) setEditedDate(d);
                                    }}
                                    disabled={(date) => {
                                      const min = new Date();
                                      min.setDate(min.getDate() + 2);
                                      min.setHours(0, 0, 0, 0);
                                      return date < min;
                                    }}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleUpdateDate(date.id, editedDate, date.dateTime)}
                                disabled={updateDateTimeMutation.isPending}
                              >
                                ✓
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => setEditingDateId(null)}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="group flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-all"
                              onClick={() => startEditingDate(date.id, date.dateTime)}
                            >
                              <CalendarIcon className="mr-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <span className="text-sm underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                                {format(parseAsLocalTime(date.dateTime), 'PPP')}
                              </span>
                              <Pencil className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingTimeId === date.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="time"
                                className="w-24 h-8 text-sm"
                                value={editedTime}
                                onChange={(e) => setEditedTime(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateTime(date.id, editedTime, date.dateTime);
                                  } else if (e.key === 'Escape') {
                                    setEditingTimeId(null);
                                  }
                                }}
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleUpdateTime(date.id, editedTime, date.dateTime)}
                                disabled={updateDateTimeMutation.isPending}
                              >
                                ✓
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="group flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-all"
                              onClick={() => startEditingTime(date.id, date.dateTime)}
                            >
                              <span className="text-sm underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                                {format(parseAsLocalTime(date.dateTime), 'HH:mm')}
                              </span>
                              <Pencil className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingDurationId === date.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="1"
                                className="w-16 h-8 text-sm"
                                value={editedDuration}
                                onChange={(e) => setEditedDuration(parseInt(e.target.value) || 1)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateDuration(date.id, editedDuration);
                                  } else if (e.key === 'Escape') {
                                    setEditingDurationId(null);
                                  }
                                }}
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleUpdateDuration(date.id, editedDuration)}
                                disabled={updateDurationMutation.isPending}
                              >
                                ✓
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="group flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-all"
                              onClick={() => startEditingDuration(date.id, date.duration || 0)}
                            >
                              <span className="text-sm underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                                {date.duration || 0} min
                              </span>
                              <Pencil className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingSeatsId === date.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="1"
                                className="w-16 h-8 text-sm"
                                value={editedSeats}
                                onChange={(e) => setEditedSeats(parseInt(e.target.value) || 1)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateSeats(date.id, editedSeats);
                                  } else if (e.key === 'Escape') {
                                    setEditingSeatsId(null);
                                  }
                                }}
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleUpdateSeats(date.id, editedSeats)}
                                disabled={updateDateMutation.isPending}
                              >
                                ✓
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="group flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-all"
                              onClick={() => startEditingSeats(date.id, date.capacity)}
                            >
                              <span className="text-sm underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                                {date.capacity}
                              </span>
                              <Pencil className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingPriceId === date.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-20 h-8 text-sm"
                                value={editedPrice}
                                onChange={(e) => setEditedPrice(parseFloat(e.target.value) || 0)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdatePrice(date.id, editedPrice);
                                  } else if (e.key === 'Escape') {
                                    setEditingPriceId(null);
                                  }
                                }}
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleUpdatePrice(date.id, editedPrice)}
                                disabled={updateDateMutation.isPending}
                              >
                                ✓
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="group flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-all"
                              onClick={() => startEditingPrice(date.id, date.price)}
                            >
                              <span className="text-sm underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                                €{Number(date.price).toFixed(2)}
                              </span>
                              <Pencil className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveDate(date.id)}
                            disabled={deleteDateMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isAddDateDialogOpen} onOpenChange={setIsAddDateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{managerCourses?.addDate || 'Add Date'}</DialogTitle>
            <DialogDescription>Add a new date for this course</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>{managerCourses?.dateHeader || 'Date'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(newDateForm.dateTime, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={newDateForm.dateTime}
                    onSelect={(d) => {
                      if (d) {
                        const current = newDateForm.dateTime;
                        d.setHours(current.getHours(), current.getMinutes(), 0, 0);
                        setNewDateForm({ ...newDateForm, dateTime: d });
                      }
                    }}
                    disabled={(date) => {
                      const min = new Date();
                      min.setDate(min.getDate() + 2);
                      min.setHours(0, 0, 0, 0);
                      return date < min;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>{managerCourses?.timeHeader || 'Time'}</Label>
              <Input
                type="time"
                value={format(newDateForm.dateTime, 'HH:mm')}
                onChange={(e) => {
                  const [hours, minutes] = e.target.value.split(':').map(Number);
                  const newDate = new Date(newDateForm.dateTime);
                  newDate.setHours(hours, minutes, 0, 0);
                  setNewDateForm({ ...newDateForm, dateTime: newDate });
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>{managerCourses?.capacityHeader || 'Capacity'}</Label>
              <Input
                type="number"
                min={1}
                value={newDateForm.capacity}
                onChange={(e) => setNewDateForm({ ...newDateForm, capacity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{managerCourses?.durationHeader || 'Duration'} (min)</Label>
              <Input
                type="number"
                min={1}
                value={newDateForm.duration}
                onChange={(e) => setNewDateForm({ ...newDateForm, duration: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{managerCourses?.price || 'Price'} (€)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={newDateForm.price}
                onChange={(e) => setNewDateForm({ ...newDateForm, price: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Default: €{Number(course?.basePrice).toFixed(2)} (base course price)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDateDialogOpen(false)}>
              {(t.common?.cancel as string) || 'Cancel'}
            </Button>
            <Button onClick={handleAddDate} disabled={createDateMutation.isPending}>
              {createDateMutation.isPending ? ((t.common?.loading as string) || 'Loading...') : (managerCourses?.addDate || 'Add Date')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
