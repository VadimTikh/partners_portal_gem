'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Trash2, Plus, Upload, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Course, CourseDate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

const courseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  sku: z.string().min(1, 'SKU is required'),
  location: z.string().min(1, 'Location is required'),
  description: z.string().min(1, 'Description is required'),
  basePrice: z.number().min(0, 'Price must be positive'),
  status: z.enum(['active', 'inactive']),
  image: z.string().optional(),
});

type CourseFormValues = z.infer<typeof courseSchema>;

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const isNew = id === 'new';
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const [dates, setDates] = useState<CourseDate[]>([]);

  const { data: course, isLoading: isCourseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => api.getCourse(id),
    enabled: !!id && !isNew,
  });

  const { data: existingDates, isLoading: isDatesLoading } = useQuery({
    queryKey: ['dates', id],
    queryFn: () => api.getDates(id),
    enabled: !!id && !isNew,
  });

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: '',
      sku: '',
      location: '',
      description: '',
      basePrice: 0,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf',
    },
  });

  useEffect(() => {
    if (course) {
      form.reset({
        title: course.title,
        sku: course.sku,
        location: course.location,
        description: course.description,
        basePrice: course.basePrice,
        status: course.status,
        image: course.image,
      });
    }
  }, [course, form]);

  useEffect(() => {
    if (existingDates) {
      setDates(existingDates);
    }
  }, [existingDates]);

  const updateCourseMutation = useMutation({
    mutationFn: api.updateCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const saveDatesMutation = useMutation({
    mutationFn: (data: { id: string; dates: CourseDate[] }) => api.saveDates(data.id, data.dates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dates', id] });
    },
  });

  const onSubmit = async (data: CourseFormValues) => {
    try {
      const courseId = isNew ? Date.now() : Number(id);
      const courseData: Course = {
        id: courseId,
        ...data,
        image: data.image || '',
      };

      await updateCourseMutation.mutateAsync(courseData);

      const datesToSave = dates.map(d => ({ ...d, courseId }));
      await saveDatesMutation.mutateAsync({ id: String(courseId), dates: datesToSave });

      toast.success(t.editor.successSaved);
      router.push('/dashboard');
    } catch (error) {
      toast.error(t.editor.failedSave);
      console.error(error);
    }
  };

  const handleAddDate = () => {
    const newDate: CourseDate = {
      id: Date.now(),
      courseId: Number(id) || 0,
      dateTime: new Date().toISOString(),
      capacity: 10,
      booked: 0,
      duration: 180,
    };
    setDates([...dates, newDate]);
  };

  const handleRemoveDate = (dateId: number) => {
    setDates(dates.filter(d => d.id !== dateId));
  };

  const handleDateChange = (dateId: number, field: keyof CourseDate, value: string | number | Date) => {
    setDates(dates.map(d => {
      if (d.id === dateId) {
        return { ...d, [field]: value };
      }
      return d;
    }));
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue('image', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isNew && (isCourseLoading || isDatesLoading)) {
    return <div className="p-8">{t.common.loading}</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {isNew ? t.editor.createTitle : t.editor.editTitle}
        </h1>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>{t.common.cancel}</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting || updateCourseMutation.isPending || saveDatesMutation.isPending}>
            {form.formState.isSubmitting ? t.editor.saving : t.editor.saveChanges}
            </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t.editor.courseInfo}</CardTitle>
                    <CardDescription>{t.editor.courseInfoDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title">{t.editor.titleLabel}</Label>
                        <Input id="title" {...form.register('title')} />
                        {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="sku" className="flex items-center gap-2">
                            {t.editor.skuLabel}
                            {!isNew && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </Label>
                        {isNew ? (
                            <Input id="sku" {...form.register('sku')} />
                        ) : (
                             <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed text-muted-foreground">
                                {form.watch('sku')}
                            </div>
                        )}
                         {form.formState.errors.sku && <p className="text-sm text-destructive">{form.formState.errors.sku.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="location" className="flex items-center gap-2">
                            {t.editor.locationLabel}
                            {!isNew && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </Label>
                        {isNew ? (
                            <Input id="location" {...form.register('location')} />
                        ) : (
                             <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed text-muted-foreground">
                                {form.watch('location')}
                            </div>
                        )}
                         {form.formState.errors.location && <p className="text-sm text-destructive">{form.formState.errors.location.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="flex items-center gap-2">
                            {t.editor.descLabel}
                            {!isNew && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </Label>
                        {isNew ? (
                            <Textarea id="description" {...form.register('description')} />
                        ) : (
                            <div
                                className="min-h-[100px] rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed"
                                dangerouslySetInnerHTML={{ __html: form.watch('description') || '' }}
                            />
                        )}
                         {form.formState.errors.description && <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="basePrice">{t.editor.priceLabel}</Label>
                            <Input id="basePrice" type="number" step="0.01" {...form.register('basePrice', { valueAsNumber: true })} />
                             {form.formState.errors.basePrice && <p className="text-sm text-destructive">{form.formState.errors.basePrice.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="status">{t.editor.statusLabel}</Label>
                            <Select 
                                onValueChange={(value) => form.setValue('status', value as 'active' | 'inactive')} 
                                defaultValue={form.getValues('status')}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t.editor.selectStatus} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">{t.common.active}</SelectItem>
                                    <SelectItem value="inactive">{t.common.inactive}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="image">{t.editor.imageLabel}</Label>
                        <div className="flex flex-col gap-4">
                             {form.watch('image') && (
                                <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                                    <img src={form.watch('image')} alt="Preview" className="h-full w-full object-cover" />
                                </div>
                             )}
                            <div className="flex items-center gap-2">
                                <Input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                <Button type="button" variant="outline" onClick={() => document.getElementById('image-upload')?.click()} className="w-full">
                                    <Upload className="mr-2 h-4 w-4" />
                                    {form.watch('image') ? t.editor.changeImage : t.editor.uploadImage}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle>{t.editor.inventory}</CardTitle>
                        <CardDescription>{t.editor.inventoryDesc}</CardDescription>
                    </div>
                    <Button size="sm" onClick={handleAddDate} variant="secondary">
                        <Plus className="h-4 w-4 mr-1" /> {t.editor.addDate}
                    </Button>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">{t.editor.dateHeader}</TableHead>
                                <TableHead>{t.editor.timeHeader}</TableHead>
                                <TableHead className="w-[100px]">{t.editor.durationHeader}</TableHead>
                                <TableHead className="w-[90px]">{t.editor.capacityHeader}</TableHead>
                                <TableHead className="w-[100px]">{t.editor.bookedHeader}</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                                        {t.editor.noDates}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                dates.map((date) => (
                                    <TableRow key={date.id}>
                                        <TableCell>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal truncate",
                                                            !date.dateTime && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                                                        <span className="truncate">
                                                            {date.dateTime ? format(new Date(date.dateTime), "PPP") : <span>{t.editor.pickDate}</span>}
                                                        </span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={new Date(date.dateTime)}
                                                        onSelect={(d) => {
                                                            if (d) {
                                                                const current = new Date(date.dateTime);
                                                                d.setHours(current.getHours(), current.getMinutes());
                                                                handleDateChange(date.id, 'dateTime', d.toISOString());
                                                            }
                                                        }}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="time" 
                                                className="w-full min-w-[90px]"
                                                value={format(new Date(date.dateTime), 'HH:mm')}
                                                onChange={(e) => {
                                                    const [hours, minutes] = e.target.value.split(':').map(Number);
                                                    const newDate = new Date(date.dateTime);
                                                    newDate.setHours(hours);
                                                    newDate.setMinutes(minutes);
                                                    handleDateChange(date.id, 'dateTime', newDate.toISOString());
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md border border-input h-10 w-full min-w-[70px] cursor-not-allowed">
                                                {date.duration || 0}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                className="w-full min-w-[70px]" 
                                                min={1} 
                                                value={date.capacity} 
                                                onChange={(e) => handleDateChange(date.id, 'capacity', parseInt(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <span className="text-sm font-medium">{date.booked}</span>
                                                <span className="text-xs text-muted-foreground">
                                                     / {date.capacity - date.booked}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveDate(date.id)}>
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
    </div>
  );
}
